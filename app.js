'use strict';

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const io = require('socket.io')();

const indexRouter = require('./routes/index');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

// send a message on successful socket connection
// socket.on('connection', function(){
//  socket.emit('message', 'Successfully connected.');
// });

const namespaces = io.of(/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/);

namespaces.on('connect', function(socket) {
  // `namespace` is purely for diagnostic purposes;
  // listen and emit ONLY on the `socket` object
  const namespace = socket.nsp;
  // `namepsace.sockets` is a Map object in Socket.io v3
  var peers = [];
  for (var peer of namespace.sockets.keys()) {
    peers.push(peer);
  }
  console.log(`Connected client: ${socket.id}`);
  console.log(`Connected peers: ${peers}`);

  // Emit the array of connected peers on initial connect
  socket.emit('connected peers', peers);

  socket.on('new connected peer', function(data) {
    // Broadcast the newly connected peer's ID to previously connected clients
    socket.broadcast.emit('new connected peer', data);
  });

  socket.on('disconnect', function() {
    console.log(`${socket.id} disconnected`);
    namespace.emit('new disconnected peer', socket.id);
  });

  // Handle signaling events and their destructured object data
  socket.on('signal', function({ to, from, description, candidate}) {
    console.log(`Received a signal from ${socket.id}`);
    console.log({to, from, description, candidate});
    // Use the .to method to only send the signal to the correct peer
    socket.to(to).emit('signal', { to, from, description, candidate });
  });
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = {app, io};
