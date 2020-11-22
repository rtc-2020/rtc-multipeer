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
  // TODO: Inform the connecting client of its ID
  socket.emit('message', `${socket.id} successfully connected on namespace ${namespace.name}`);
  console.log(`Client ${socket.id} connected`);
  // TODO: Inform the connecting client of all connected clients on the namespace
  namespace.clients(function(error,clients) {
    socket.emit('connected peers', clients);
  });
  socket.on('new connected peer', function(data) {
    // Broadcast the newly connected peer's ID to previously connected clients
    socket.broadcast.emit('new connected peer', data);
  });

  socket.on('disconnect', function() {
    console.log(`${socket.id} disconnected`);
    namespace.emit('new disconnected peer', socket.id);
  });


  // Listen for a call and broadcast to the receiving client
  // TODO: Improve this logic for multipeer connections; right now, this just triggers the
  // "answer" button and negotiation logic
  socket.on('calling', function() {
    socket.broadcast.emit('calling');
  });


  // Handle signaling events and their destructured object data
  // TODO: This logic should send signaling meesage to a specific peer
  socket.on('signal', function({ description, candidate}) {
    console.log(`Received a signal from ${socket.id}`);
    console.log({description, candidate});
    // We want to broadcast the received signal so that the sending
    // side does not receive its own description or candidate
    socket.broadcast.emit('signal', { description, candidate });
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
