const request = require('request').defaults({ encoding: null })
const fs = require('fs')
const crypto = require('crypto')

const Discord = require('discord.js')
const client = new Discord.Client()
const phash = require('phash-im')

const pokecordId = '365975655608745985'
const channelId = '543814442132045835'

function decryptPokemon () {
  return new Promise(function (resolve, reject) {
    const key = crypto.scryptSync('*$tXMs7uZFL2am7B!itWD$bVXA%WTQ', 'salt_9158246', 24)
    const iv = Buffer.alloc(16, 0)
    const decipher = crypto.createDecipheriv('aes-192-cbc', key, iv)
    let decrypted = ''
    decipher.on('readable', () => {
      let chunk
      while ((chunk = decipher.read()) !== null) {
        decrypted += chunk.toString('utf8')
      }
    })
    decipher.on('end', () => {
      resolve(decrypted)
    })
    const input = fs.createReadStream('pokemon.bin')
    input.pipe(decipher)
  })
}

// warning: race condition
var hashes = []
decryptPokemon().then(x => {
  hashes = JSON.parse(x)
})

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`)
})

async function recognizePokemon () {
  let ph = await phash.compute('temp.jpg')
  let minVal = 100
  let name = 'unknown'
  for (let hash of hashes) {
    let diff = await phash.compare(hash.phash, ph)
    if (diff < minVal) {
      minVal = diff
      name = hash.name
    }
  }
  return name
}

async function handleRetrogradeRecognition (id, channel) {
  console.log('.mm command issued')
  let fetched = null
  try {
    fetched = await channel.fetchMessage(id)
  } catch (e) {
    channel.send('Could not fetch message ' + id).then(m => setTimeout(() => m.delete(), 4000))
    return
  }
  try {
    let url = fetched.embeds[0].image.url
    request(url).pipe(fs.createWriteStream('temp.jpg')).on('close', async () => {
      channel.send(`p!catch ${await recognizePokemon()}`)
    })
  } catch (e) {
    channel.send('It seems that message is not a wild Pokémon.').then(m => setTimeout(() => m.delete(), 4000))
  }
}

var spamInterval = null

function startSpam (channel) {
  let words = [
    'hi there',
    'howdy',
    'greetings',
    "hey, what's up",
    "what's going on",
    'hey!',
    "how's everything",
    'how are things?',
    'good to see you',
    'nice to see you',
    'great to see you',
    "what's happening",
    "how's it going",
    'hey, boo',
    'how are you?',
    'nice to meet you!',
    'long time no see',
    "what's the good word?",
    "what's new?",
    'look who it is!',
    'how have you been?',
    'nice to see you again',
    'how are you doing today?',
    'what have you been up to?',
    'how are you feeling today?',
    'look what the cat dragged in!'
  ]
  function randomWord () {
    let index = Math.floor(Math.random() * words.length)
    return words[index]
  }
  spamInterval = setInterval(() => {
    channel.send(randomWord())
  }, 4000)
  console.log('spam started')
}

function stopSpam () {
  clearInterval(spamInterval)
  spamInterval = null
  console.log('spam stopped')
}

client.on('message', async msg => {
  if (msg.channel.id === channelId && msg.author.id === pokecordId) {
    console.log('Message form Pokécord', msg.embeds.length)
    if (msg.embeds.length > 0) console.log(msg.embeds[0].title)
    if (msg.embeds.length > 0 && msg.embeds[0].title.trim() === '‌‌A wild pokémon has appeared!') {
      console.log('Wild Pokémon.')
      let url = msg.embeds[0].image.url
      request(url).pipe(fs.createWriteStream('temp.jpg')).on('close', async () => {
        msg.channel.send(`p!catch ${await recognizePokemon()}`)
      })
    }
  }

  if (msg.channel.id === channelId && msg.author.id === client.user.id) {
    let r = /^\.mm\s+(\d+)/.exec(msg.content)
    if (r !== null) {
      msg.delete()
      await handleRetrogradeRecognition(r[1], msg.channel)
      return
    }
    r = /^.spam/.test(msg.content)
    if (r) {
      msg.delete()
      if (spamInterval === null) startSpam(msg.channel)
      else stopSpam()
    }
  }
})

client.login(process.env.discord_token)
