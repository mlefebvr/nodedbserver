# Node DB Server
A very simple proof-of-concept in-memory key-value database written in Javascript

The server listens on port 8000 by default for client connections, and uses the port 18000 for peer-to-peer connections (client port + 10000)

## Usage
1. Start the primary server
  1. Default port is 8000, but you can override with the LPORT environment variable
2. Start as many peers as required
  1. Use the PEER_NODE and PEER_PORT to connect it to another peer
  2. If PEER_NODE and PEER_PORT are not specified, the server will start in standalone/primary mode

## Client communications
The server supports a limited set of commands for client connections:
1. SET \<key\> \<value\>: Set \<key\> to \<value\>. This command is dispatched to all of a server's peers.
2. GET \<key\>: Return the value of \<key\>
3. DEL \<key\>: Delete \<key\>. This command is dispatched to all of a server's peers.
4. SHOW PEERS: Causes the server(s) to print out their list of peers. This command is dispatched to all of a server's peers.
5. SHOW DATA: Causes the server(s) to print out the contents of their data store. This command is dispatched to all of a server's peers.

## Peer Communications
When starting a server with PEER_NODE and PEER_PORT defined, the server will connect to the peer on the specified PEER_PORT (client port + 10000).

After the connection is established, it will send the PEER \<serverId\> command, where \<serverId\> is a random UUID generated when the server started.

If the new server's data store is empty, it issues the GET DATA command to it's peer. The peer server replies with a series of "SET" commands that the new server uses to rebuild it's data store to match the peer server's.
