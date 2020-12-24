const http = require('http');
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./users');
const router = require('./router');

const PORT = process.env.PORT || 5000;

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors:{
        origin:'*',
    }
});

app.use(fileUpload());
app.use(cors());
app.use(router);
app.use('/uploads',express.static('uploads'));

app.post('/upload', (req, res)=> {
    req.files.file.mv(`uploads/${req.files.file.name}`);
    return res.status(200).json({ msg: 'success', url: `uploads/${req.files.file.name}`});
})

io.on('connection', (socket)=>{
    console.log('we have a new connection!!');

    socket.on('join', ({name, room}, callback)=> {
        const { error, user } = addUser({ id: socket.id, name, room});
        if(error) return callback(error);
        socket.join(user.room);
        socket.emit('message', {user: 'admin', text: `${user.name}, welcome to the room ${user.room}` });
        socket.broadcast.to(user.room).emit('message', {user: 'admin', text: `${user.name}, has joined!` });
        io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });
        callback();
    });
    socket.on('sendMessage', (message, callback)=> {
        const user = getUser(socket.id);

        io.to(user.room).emit('message', { user: user.name, text: message });
        callback();
    });

    socket.on('typing', ({ name, room}, callback)=> {
        socket.broadcast.to(room).emit('userTyping', {text: `${name}, is typing!` });
        callback();
    });
    socket.on('clearTyping', ({ name, room}, callback)=> {
        socket.broadcast.to(room).emit('userTyping', {text: `` });
        callback();
    });
    socket.on('disconnect', ()=>{
        const user = removeUser(socket.id);
        if(user) {
            io.to(user.room).emit('message', { user: 'Admin', text: `${user.name} has left.` });
            io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room)});
        }
    })
})

server.listen(PORT,()=> console.log(`server is started on ${PORT}`))