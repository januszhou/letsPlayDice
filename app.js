/**
 * Created by zhou on 7/13/16.
 */
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var exphbs  = require('express-handlebars');


var mysql      = require('mysql');
var connection = mysql.createConnection({
    host     : 'localhost',
    user     : 'homestead',
    password : 'secret',
    database : 'dice'
});

connection.connect();


app.use('/bower_components', express.static('bower_components'));
app.use('/node_modules', express.static('node_modules'));

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.get('/', function(req, res){
    res.render('home');
});

app.post('/room', function(){
    
})

io.on('connection', function(socket){
    socket.on('chat message', function(msg){
        console.log('message: ' + msg);
    });

    console.log('a user connected');

    socket.on('disconnect', function(){
        console.log('user disconnected');
    });
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});