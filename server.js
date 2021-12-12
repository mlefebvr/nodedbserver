const net = require('net')
const { v4: uuidv4, validate: uuidValidate } = require('uuid')

const peerNode = process.env.PEER_NODE
const peerPort = process.env.PEER_PORT
const lport = process.env.LPORT || 8000

const dataStore = {}

const peers = {
  peerList: {},
  add: (peerId, peer) => {
    peers.peerList[peerId] = peer
  },
  dispatchCommand: (command) => {
    Object.keys(peers.peerList).forEach((id) => {
      peers.peerList[id].write(command)
    })
  }
}

const serverId = uuidv4()

const clientServer = net.createServer((client) => {
  console.log('client connected')

  client.on('end', () => {
    console.log('Client disconnected')
  })

  client.on('data', (data) => {
    data.toString().split(/\n/).forEach((line) => {
      if (line.match(/^SET /)) {
        const match = line.match(/^SET ([\d|\w]+) (.+)/)
        const [, key, value] = match
        dataStore[key] = value
        peers.dispatchCommand(line)
      }

      if (line.match(/^DEL /)) {
        const match = line.match(/^DEL ([\d|\w]+)/)
        const [, key] = match
        delete dataStore[key]
        peers.dispatchCommand(line)
      }

      if (line.match(/^GET /)) {
        const match = line.match(/^GET ([\d|\w]+)/)
        const [, key] = match
        if (dataStore[key]) client.write(`${dataStore[key]}\n`)
      }

      if (line.match(/^SHOW DATA/)) {
        console.log(dataStore)
        peers.dispatchCommand(line)
      }

      if (line.match(/^SHOW PEERS/)) {
        console.log(peers)
        peers.dispatchCommand(line)
      }
    })
  })
})

const peerServer = net.createServer((peer) => {
  console.log('Peer connected')
  peer.on('end', () => {
    console.log('Lost connection to peer ', peer.peerId)
    delete peers.peerList[peer.peerId]
  })

  peer.on('data', (data) => {
    data.toString().split(/\n/).forEach((line) => {
      if (line.match(/^PEER /)) {
        // Handshake
        const match = line.match(/^PEER (.+)/)
        const peerId = match[1]
        if (uuidValidate(peerId)) {
          if (peerId === serverId) {
            console.log('Peer tried to steal my identity!')
            peer.end()
          } else if (peers[peerId]) {
            console.log('Unable to reuse peer id ', peerId)
            peer.end()
          } else {
            peer.peerId = peerId
            peers.add(peerId, peer)
            peer.write(`PEER ${serverId}\n`)
          }
        } else {
          console.log(`UUID ${peerId} is not valid`)
          peer.end()
        }
      }

      if (line.match(/^GET DATA/)) {
        console.log(`Sending existing data to ${peer.peerId}`)
        Object.keys(dataStore).forEach((rowKey) => {
          const rowValue = dataStore[rowKey]
          peer.write(`SET ${rowKey} ${rowValue}\n`)
        })
      }
    })
  })
})

if (peerNode && peerPort) {
  console.log(`Connecting to peer ${peerNode}:${peerPort}`)
  const peerClient = net.createConnection({
    host: peerNode,
    port: peerPort
  })

  peerClient.on('end', () => {
    console.log('Peer Server has terminated the connection')
    process.exit()
  })
  peerClient.on('connect', (s) => {
    peerClient.write(`PEER ${serverId}\n`)
    if (Object.keys(dataStore).length === 0) {
      peerClient.write('GET DATA\n')
    }
  })

  peerClient.on('data', (data) => {
    data.toString().split(/\n/).forEach((line) => {
      if (line.match(/^PEER /)) {
        // Handshake
        console.log('Adding Peer Server to peer list')
        const match = line.match(/^PEER (.+)/)
        const peerId = match[1]
        if (uuidValidate(peerId)) {
          if (peerId === serverId) {
            console.log('Peer tried to steal my identity!')
            peer.end()
          } else if (peers[peerId]) {
            console.log('Unable to reuse peer id ', peerId)
            peer.end()
          } else {
            peerClient.peerId = peerId
            peers.add(peerId, peerClient)
          }
        } else {
          console.log(`UUID ${peerId} is not valid`)
          peer.end()
        }
      }

      if (line.match(/^SET /)) {
        const match = line.match(/^SET ([\d|\w]+) (.+)/)
        const [, key, value] = match
        dataStore[key] = value
      }

      if (line.match(/^DEL /)) {
        const match = line.match(/^DEL ([\d|\w]+)/)
        const [, key] = match
        delete dataStore[key]
      }

      if (line.match(/^SHOW DATA/)) {
        console.log(dataStore)
      }

      if (line.match(/^SHOW PEERS/)) {
        console.log(peers)
      }
    })
  })
} else {
  console.log('Running in standalone/primary mode')
}

clientServer.listen(lport, () => console.log('Client server running, serverId: ', serverId))
peerServer.listen(Number(lport) + Number(10000), () => console.log('Peer server running, serverId: ', serverId))