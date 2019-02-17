const crypto = require('crypto')
const fs = require('fs')

const key = crypto.scryptSync('*$tXMs7uZFL2am7B!itWD$bVXA%WTQ', 'salt_9158246', 24)
const iv = Buffer.alloc(16, 0)
const cipher = crypto.createCipheriv('aes-192-cbc', key, iv)
const input = fs.createReadStream('pokemon.json')
const output = fs.createWriteStream('pokemon.bin')
input.pipe(cipher).pipe(output).on('close', () => console.log('done'))
