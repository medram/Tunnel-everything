const net = require('net')

let dhost = "127.0.0.1"
let dport = 22
let listen_port = 8080
let fakeWebsocketReply = false


for (c = 0; c < process.argv.length; c++)
{
	switch (process.argv[c])
	{
		case '-t':
			[ host, port ] = process.argv[c+1].split(':')
			dhost = host
			dport = port || dport
			break
		case '--listen-port':
		case '-l':
			listen_port = process.argv[c+1]
			break
		case '--fake-ws-reply':
			fakeWebsocketReply = (process.argv[c+1] === 'true')
	}
}

console.log(`
	Target: ${dhost}:${dport}
	Server listen on: 0.0.0.0:${listen_port}
`)

function parseRemoteAddr(raddr) {
    if(raddr && raddr.toString().indexOf("ffff") != -1) {
        //is IPV4 address
        return raddr.substring(7, raddr.length);
    }
    return raddr
}

// Creating a server
const server = net.createServer()

server.on("connection", (socket) => {

	console.log(`[INFO] - Connection received from ${parseRemoteAddr(socket.remoteAddress)}:${socket.remotePort}`)
	let conn = net.createConnection({host: dhost, port: dport})
	let sentFakeWebsocketReply = false


	socket.on('data', (data) => {
		// send a fake Websocket reply
		if (!sentFakeWebsocketReply && fakeWebsocketReply)
		{
			fakeWebsocketReply = true
			socket.write("HTTP/1.1 101 Switching Protocols (Nodejs)\r\nContent-Length: 1048576000000\r\n\r\n");
			return null
		}

		// Send the rest if the data to destination (SSH or VPN, ...etc)
		conn.write(data)
	})

	socket.on('error', (error) => {
		console.log(`[ERROR] - Server Error: ${error}`)
		conn.destroy()
	})

	socket.on('close', () => {
		console.log(`[INFO] - Connection terminated for ${parseRemoteAddr(socket.remoteAddress)}:${socket.remotePort}`)
		conn.destroy()
		// delete from clients list
		//clients.splice(clients.indexOf(socket), 1)
	})

	conn.on('connect', () => {
			console.log(`[INFO] - Tunnel: ${parseRemoteAddr(socket.localAddress)}:${socket.localPort}  >>> ${parseRemoteAddr(socket.remoteAddress)}:${socket.remotePort} >>> ${parseRemoteAddr(conn.localAddress)}:${conn.localPort}  >>> ${parseRemoteAddr(conn.remoteAddress)}:${conn.remotePort}`)
	})

	conn.on('data', (data) => {
		// piping
		socket.write(data)
	})

	conn.on('close', () => {
		console.log(`[INFO] - Destination connection terminated for ${parseRemoteAddr(socket.remoteAddress)}:${socket.remotePort}`)
		socket.destroy()
	})

	conn.on('error', (error) => {
		console.log(`[ERROR] - Socket error for ${parseRemoteAddr(socket.remoteAddress)}:${socket.remotePort} - ${error}`)
		socket.destroy()
	})


})

server.on('error', (error) => {
	console.log(`[ERROR] - Server Error: ${error}`)
})

server.on('close', () => {
	console.log('[INFO] - Server terminated.')
})

server.listen(listen_port, () => {
	let { address, port } = server.address()

	address = (address === '::') && '127.0.0.1'

	console.log(`[INFO] - Server started & listening on: ${address}:${port}`)
	console.log(`[INFO] - Tunnuling: ${address}:${port} <---> ${dhost}:${dport}`)
})
