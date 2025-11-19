import Foundation
import AVFoundation
@preconcurrency import ScreenCaptureKit
import CoreMedia
import AudioToolbox

@main
@available(macOS 13.0, *)
struct SystemAudioDump {
  static func main() async {
    do {
      print("Starting SystemAudioDump...")
      
      // Check if we have screen recording permission
      print("Checking permissions...")
      let canRecord = CGPreflightScreenCaptureAccess()
      if !canRecord {
        print("❌ Screen recording permission required!")
        print("Please go to System Preferences > Security & Privacy > Privacy > Screen Recording")
        print("and enable access for this application.")
        
        // Request permission
        let granted = CGRequestScreenCaptureAccess()
        if !granted {
          print("Permission denied. Exiting.")
          exit(1)
        }
      }
      print("✅ Permissions OK")
      
      // 1) Grab shareable content
      print("Getting shareable content...")
      let content = try await SCShareableContent.excludingDesktopWindows(false,
                                                                        onScreenWindowsOnly: true)
      guard let display = content.displays.first else {
        fatalError("No display found")
      }
      print("Found display: \(display)")

      // 2) Build a filter for that display (video is ignored below)
      let filter = SCContentFilter(display: display,
                                   excludingApplications: [],
                                   exceptingWindows: [])
      print("Created filter")

      // 3) Build a stream config that only captures audio
      let cfg = SCStreamConfiguration()
      cfg.capturesAudio = true
      
      // ✅ 条件检查 macOS 15.0+ 的功能
      if #available(macOS 15.0, *) {
        cfg.captureMicrophone = false
      }
      
      cfg.excludesCurrentProcessAudio = true
      
      // ✅ 明确设置采样率，避免不同架构的默认值差异
      cfg.sampleRate = 48000
      cfg.channelCount = 2  // 使用立体声,后续转为单声道
      
      print("Created configuration")

      // 4) Create and start the stream
      let dumper = AudioDumper()
      let stream = SCStream(filter: filter,
                            configuration: cfg,
                            delegate: dumper)
      print("Created stream")

      // only install audio output
      try stream.addStreamOutput(dumper,
                                 type: .audio,
                                 sampleHandlerQueue: DispatchQueue(label: "audio"))
      print("Added stream output")
      
      try await stream.startCapture()
      print("Started capture")

      await MainActor.run {
        print("✅ Capturing system audio. Press ⌃C to stop.", to: &standardError)
      }
      
      // keep the process alive with a safer approach
      print("Entering main loop...")
      
      // Set up signal handling for graceful shutdown
      signal(SIGINT) { _ in
        print("Received SIGINT, shutting down...")
        exit(0)
      }
      
      // Keep alive with a simple loop instead of dispatchMain
      while true {
        try await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
      }

    } catch {
      fputs("Error: \(error)\n", Darwin.stderr)
      exit(1)
    }
  }
}

/// A simple SCStreamOutput + SCStreamDelegate that converts to 24 kHz Int16 PCM and writes to stdout
@available(macOS 13.0, *)
final class AudioDumper: NSObject, SCStreamDelegate, SCStreamOutput {
  private var converter: AVAudioConverter?
  private var outputFormat: AVAudioFormat?
  
  // ✅ 添加调试标志
  private var debugLogged = false

  func stream(_ stream: SCStream,
              didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
              of outputType: SCStreamOutputType) {
    guard outputType == .audio else { return }

    // ✅ 使用更安全的 CMSampleBuffer 处理方式
    guard let formatDescription = sampleBuffer.formatDescription else {
      fputs("No format description\n", Darwin.stderr)
      return
    }
    
    let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDescription)
    guard let streamDesc = asbd else {
      fputs("No stream description\n", Darwin.stderr)
      return
    }
    
    // ✅ 首次执行时打印详细的格式信息
    if !debugLogged {
      debugLogged = true
      fputs("=== Audio Format Info ===\n", Darwin.stderr)
      fputs("Sample Rate: \(streamDesc.pointee.mSampleRate)\n", Darwin.stderr)
      fputs("Channels: \(streamDesc.pointee.mChannelsPerFrame)\n", Darwin.stderr)
      fputs("Format ID: 0x\(String(streamDesc.pointee.mFormatID, radix: 16))\n", Darwin.stderr)
      fputs("Format Flags: 0x\(String(streamDesc.pointee.mFormatFlags, radix: 16))\n", Darwin.stderr)
      fputs("Bytes per Frame: \(streamDesc.pointee.mBytesPerFrame)\n", Darwin.stderr)
      fputs("Bits per Channel: \(streamDesc.pointee.mBitsPerChannel)\n", Darwin.stderr)
      fputs("=========================\n", Darwin.stderr)
    }

    // Initialize converter on first buffer
    if converter == nil {
      // ✅ 创建源格式 - 直接使用，不需要 guard let
      let srcFormat = AVAudioFormat(cmAudioFormatDescription: formatDescription)
      
      // target: 24 kHz, Int16, mono, interleaved
      guard let targetFormat = AVAudioFormat(commonFormat: .pcmFormatInt16,
                                           sampleRate: 24_000,
                                           channels: 1,
                                           interleaved: true) else {
        fputs("Failed to create target format\n", Darwin.stderr)
        return
      }
      
      outputFormat = targetFormat
      converter = AVAudioConverter(from: srcFormat, to: targetFormat)
      
      // ✅ 修复：不使用 if let
      if converter != nil {
        fputs("✅ Converter created: \(srcFormat.sampleRate)Hz \(srcFormat.channelCount)ch -> \(targetFormat.sampleRate)Hz \(targetFormat.channelCount)ch\n", Darwin.stderr)
      }
    }

    guard let converter = converter,
          let outFmt = outputFormat else {
      fputs("Converter not initialized\n", Darwin.stderr)
      return
    }

    // ✅ 使用 CMSampleBuffer 的原生方法创建 AVAudioPCMBuffer
    let srcFmt = converter.inputFormat
    let numSamples = CMSampleBufferGetNumSamples(sampleBuffer)
    
    guard let srcBuffer = AVAudioPCMBuffer(pcmFormat: srcFmt,
                                           frameCapacity: AVAudioFrameCount(numSamples)) else {
      fputs("Failed to create source buffer\n", Darwin.stderr)
      return
    }
    srcBuffer.frameLength = AVAudioFrameCount(numSamples)

    // ✅ 使用更安全的方式填充数据
    var audioBufferList = AudioBufferList()
    var blockBuffer: CMBlockBuffer?
    
    let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
      sampleBuffer,
      bufferListSizeNeededOut: nil,
      bufferListOut: &audioBufferList,
      bufferListSize: MemoryLayout<AudioBufferList>.size,
      blockBufferAllocator: nil,
      blockBufferMemoryAllocator: nil,
      flags: 0,
      blockBufferOut: &blockBuffer
    )
    
    if status != noErr {
      fputs("Failed to get audio buffer list: \(status)\n", Darwin.stderr)
      return
    }
    
    defer {
      if let block = blockBuffer {
        // blockBuffer will be released automatically
        _ = block
      }
    }
    
    // ✅ 安全地复制数据
    let channelCount = Int(srcFmt.channelCount)
    let frameCount = Int(numSamples)
    
    // 根据格式选择正确的数据类型
    if srcFmt.commonFormat == .pcmFormatFloat32 {
      // Float32 格式
      guard let dstPlanes = srcBuffer.floatChannelData else {
        fputs("No float channel data\n", Darwin.stderr)
        return
      }
      
      if srcFmt.isInterleaved {
        // 交错格式
        guard audioBufferList.mNumberBuffers > 0 else { return }
        let buffer = audioBufferList.mBuffers
        guard let data = buffer.mData else { return }
        
        let samples = data.bindMemory(to: Float.self, capacity: frameCount * channelCount)
        
        for frame in 0..<frameCount {
          for ch in 0..<channelCount {
            dstPlanes[ch][frame] = samples[frame * channelCount + ch]
          }
        }
      } else {
        // 非交错格式
        for ch in 0..<min(channelCount, Int(audioBufferList.mNumberBuffers)) {
          let bufferPtr = withUnsafePointer(to: audioBufferList.mBuffers) { ptr in
            UnsafeBufferPointer(start: ptr, count: Int(audioBufferList.mNumberBuffers))
          }
          
          guard ch < bufferPtr.count,
                let data = bufferPtr[ch].mData else { continue }
          
          let samples = data.bindMemory(to: Float.self, capacity: frameCount)
          // ✅ 使用 update 代替 assign
          dstPlanes[ch].update(from: samples, count: frameCount)
        }
      }
    } else {
      // 假设是 Int16 格式
      fputs("⚠️ Non-float format detected, may need conversion\n", Darwin.stderr)
      
      // ✅ 添加 Int16 格式的处理
      guard let dstPlanes = srcBuffer.floatChannelData else {
        fputs("No float channel data for conversion\n", Darwin.stderr)
        return
      }
      
      if srcFmt.isInterleaved {
        guard audioBufferList.mNumberBuffers > 0 else { return }
        let buffer = audioBufferList.mBuffers
        guard let data = buffer.mData else { return }
        
        let samples = data.bindMemory(to: Int16.self, capacity: frameCount * channelCount)
        
        for frame in 0..<frameCount {
          for ch in 0..<channelCount {
            let sample = samples[frame * channelCount + ch]
            dstPlanes[ch][frame] = Float(sample) / 32768.0
          }
        }
      } else {
        for ch in 0..<min(channelCount, Int(audioBufferList.mNumberBuffers)) {
          let bufferPtr = withUnsafePointer(to: audioBufferList.mBuffers) { ptr in
            UnsafeBufferPointer(start: ptr, count: Int(audioBufferList.mNumberBuffers))
          }
          
          guard ch < bufferPtr.count,
                let data = bufferPtr[ch].mData else { continue }
          
          let samples = data.bindMemory(to: Int16.self, capacity: frameCount)
          
          for frame in 0..<frameCount {
            dstPlanes[ch][frame] = Float(samples[frame]) / 32768.0
          }
        }
      }
    }

    // ✅ 计算输出缓冲区大小（考虑采样率转换）
    let outputFrameCapacity = AVAudioFrameCount(
      ceil(Double(srcBuffer.frameLength) * outFmt.sampleRate / srcFmt.sampleRate)
    ) + 1024  // 添加安全边界
    
    guard let outBuffer = AVAudioPCMBuffer(pcmFormat: outFmt,
                                         frameCapacity: outputFrameCapacity) else {
      fputs("Failed to create output buffer\n", Darwin.stderr)
      return
    }
    
    // ✅ 执行转换
    var error: NSError?
    let conversionStatus = converter.convert(to: outBuffer, error: &error) { _, outStatus in
      outStatus.pointee = .haveData
      return srcBuffer
    }
    
    if conversionStatus == .error {
      if let err = error {
        fputs("Conversion error: \(err)\n", Darwin.stderr)
      } else {
        fputs("Unknown conversion error\n", Darwin.stderr)
      }
      return
    }
    
    guard outBuffer.frameLength > 0,
          let int16Data = outBuffer.int16ChannelData?[0] else {
      fputs("No output data\n", Darwin.stderr)
      return
    }

    // ✅ 写入标准输出
    let byteCount = Int(outBuffer.frameLength) * MemoryLayout<Int16>.size
    let data = Data(bytes: int16Data, count: byteCount)
    FileHandle.standardOutput.write(data)
  }
  
  func stream(_ stream: SCStream, didStopWithError error: Error) {
    fputs("Stream stopped with error: \(error)\n", Darwin.stderr)
  }
}

// Helper to print to stderr
@MainActor var standardError = FileHandle.standardError
extension FileHandle: @retroactive TextOutputStream {
  public func write(_ string: String) {
    if let data = string.data(using: .utf8) {
      self.write(data)
    }
  }
}