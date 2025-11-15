const fs = require('node:fs')
const path = require('node:path')

async function main() {
  const apiBase = process.env.AIHUBMIX_BASE || 'https://aihubmix.com/v1'
  const apiKey = process.env.AIHUBMIX_KEY || ''
  const model = process.env.AIHUBMIX_MODEL || 'qwen3-vl-30b-a3b-instruct'
  const imagePath = process.env.TEST_IMAGE || path.join(__dirname, 'sample.jpg')
  const prompt = process.env.TEST_PROMPT || '这张图片里面是什么，请用比较生动的语言描述'

  if (!apiKey) {
    console.error('Missing AIHUBMIX_KEY env')
    process.exit(1)
  }

  if (!fs.existsSync(imagePath)) {
    console.error('Image file not found:', imagePath)
    process.exit(1)
  }

  const imgBuf = fs.readFileSync(imagePath)
  const base64 = imgBuf.toString('base64')
  const mime = 'image/jpeg'
  const dataUrl = `data:${mime};base64,${base64}`

  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }
    ],
    stream: false
  }

  console.log('POST', apiBase + '/chat/completions')
  console.log('Model:', model)
  console.log('Prompt length:', prompt.length)
  console.log('Image base64 length:', base64.length)

  const res = await fetch(apiBase.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  })

  console.log('Status:', res.status)
  const text = await res.text()
  console.log('Response raw:', text.slice(0, 500))
  try {
    const json = JSON.parse(text)
    console.log('Parsed content:', json?.choices?.[0]?.message?.content)
  } catch {
    // ignore
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
