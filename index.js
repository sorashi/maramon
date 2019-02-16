const request = require('request').defaults({	encoding: null })
const fs = require('fs')

const Discord = require('discord.js')
const client = new Discord.Client()
const phash = require('phash-im')
const hashes = require('./pokemon.json')

const pokecordId = '365975655608745985'
const channelId = '543814442132045835'

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`)
  // var msg = await client.channels.get('543814442132045835').fetchMessage('546375655839891456')
  // let url = msg.embeds[0].image.url
  // request(url).pipe(fs.createWriteStream('temp.jpg')).on('close', async () => {
  //   msg.channel.send(`p!catch ${await recognizePokemon()}`)
  // })
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

client.on('message', msg => {
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
})

client.login(process.env.discord_token)
