/**
 * Created by zhou on 7/13/16.
 */
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var exphbs  = require('express-handlebars');

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies


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

app.get('/slice', function(req, res){
    res.render('slice');
});

var currentUserId = null;

var randomNick = function(){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
};

var randomRoom = function(){
    return Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
};

/**
 * Create room from home page
 */
app.post('/room', function(req, res){
    var room = req.body.room;
    connection.query("select * from room where number = " + room, function(err, rows, fields){
       if(rows && rows.length > 0){
           /**
            * If room exists, Insert player into that room, then redirect to that room
            */

           var playerObj = {room_id: room, nick_name: randomNick()};
           connection.query('INSERT INTO player SET ?', playerObj, function(err, result) {
               if(!err){
                   res.redirect('/room/' + room);
               }
           });

       } else {
           /**
            * Room not exist, we create a new room
            */
           var newRoomObj  = {password: null, hash: null, number: randomRoom()};
           var createNewRoom = connection.query('INSERT INTO room SET ?', newRoomObj, function(err, result) {

               if(!err){
                   /**
                    * Insert player into that room
                    */
                   var playerObj = {room_id: result.insertId, nick_name: randomNick()};
                   connection.query('INSERT INTO player SET ?', playerObj, function(err, result) {
                       res.redirect('/room/' + randomRoom);
                   });
               }
           });

       }
    });
});

var deletePlayer = function(connection, socketId,  callback){
    connection.query("delete from player where socket_id = ? ", socketId, function(err, result){
        callback(err, result);
    });
};

var getPlayers = function(connection, roomId,  callback){
    connection.query("select * from player where room_id = ? ", roomId, function(err, result){
        callback(err, result);
    });
};

var updatePlayer = function(connection, playerId, updateObj, callback){
    connection.query("update player set ? where id = ? ",[updateObj, playerId], function(err, result){
        callback(err, result);
    });
};

var getPlayersData = function(connection, roomId, callback){
    getPlayers(connection, roomId, function(err, result){
        var players = {self:null, others: []};

        for(var i = 0; i<= result.length - 1; i++){
            var player = {};
            player['nick_name'] = result[i]['nick_name'];
            player['ready'] = result[i]['ready'];
            player['id'] = result[i]['id'];

            if(result[i]['id'] == currentUserId){
                players['self'] = player;
            } else {
                players['others'].push(player);
            }
        }

        callback(players);
    });
};

var sockets = {};

io.on('connection', function(socket){
    sockets[socket.id] = socket;
    var currentRoomId = null;
    /**
     * Front-end emit room event when player join a room
     */
    socket.on('join', function(obj){
        socket.join('room_' + obj.roomId);
        currentRoomId = obj.roomId;
        /**
         * Update player socket id
         */
        updatePlayer(connection, currentUserId, {socket_id: '/#' + obj.socketId}, function(err, result){

        });

        /**
         * Emit new player, and update others view
         */
        getPlayersData(connection, obj.roomId, function(players){
            socket.to('room_' + obj.roomId).emit('updatePlayers', players);
        });
    });

    socket.on('ready', function(req){
        var roomId = req['room_id'];
        var playerId = req['player_id'];
        var ready = req['ready'];
        console.log('update player is ready');

        /**
         * Update database set player ready
         */
        updatePlayer(connection, playerId, {ready: ready}, function(err, result){
            socket.to('room_' + roomId).emit('player_ready', playerId);
        });

    });

    console.log('a user connected');
    // socket.emit('player_join', players);

    socket.on('disconnect', function(){

        deletePlayer(connection, socket.id, function(err, result){
            if(!err){
                console.log('a user disconnected');
            }
        });

        /**
         * Emit player left, and update others view
         */
        getPlayersData(connection, currentRoomId, function(players){
            socket.to('room_' + currentRoomId).emit('updatePlayers', players);
        });
    });
});


app.get('/room/:id', function(req, res){
    var id = req.params.id;

    var playerObj = {room_id: id, nick_name: randomNick()};
    connection.query('INSERT INTO player SET ?', playerObj, function(err, result) {
        if(!err){
            currentUserId = result.insertId;
            getPlayersData(connection, id, function(players){
                res.render('room', {id: id, players: players});
            });
        }
    });
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});