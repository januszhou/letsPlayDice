/**
 * Created by zhou on 7/13/16.
 */
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var exphbs  = require('express-handlebars');
var cookieParser = require('cookie-parser');
var underscore = require('underscore');

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

var storage = require('node-persist');
storage.initSync();


app.use('/bower_components', express.static('bower_components'));
app.use('/node_modules', express.static('node_modules'));
app.use('/content', express.static('content'));

app.use(cookieParser());

app.engine('handlebars', exphbs({
    defaultLayout: 'main',
    helpers: { json: function (context) { return JSON.stringify(context); } }
}));
app.set('view engine', 'handlebars');

app.get('/', function(req, res){
    res.render('home');
});

app.get('/slice', function(req, res){
    res.render('slice');
});

var randomRoom = function(){
    return Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
};


/**
 * Player Object
 * @constructor
 */
var Player = function(){
    var randomNick = function(length){
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for( var i = 0; i < length - 1; i++ )
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    };

    this.nickName = randomNick(5);
    this.round = null;
    this.owner = false;
    this.UID = randomNick(20);
    this.ready = false;
    this.leave = false;
    this.socketId = null;
};

Player.prototype.updateNick = function(nick){
    this.nickName = nick;
};

Player.prototype.updateLeaveStatus = function(status){
    this.leave = status;
};

Player.prototype.updateSocket = function(socketId){
    this.socketId = socketId;
};

Player.prototype.createRound = function(){
    var getRandomArbitrary = function(min, max) {
        return Math.random() * (max - min) + min;
    };

    var round = [];

    for(var i = 0; i <= 4; i++){
        round.push(getRandomArbitrary(1, 5));
    }

    this.round = round;
};

Player.prototype.updateOwner = function(){
    this.owner = true;
};

Player.prototype.updateUID = function(UID){
    this.UID = UID;
};

/**
 * Room Object
 * @constructor
 */

var Room = function(id){
    this.status = 'waiting';
    this.players = [];
    this.password = false;
    this.games = 0;
    this.id = id;
};

Room.prototype.start = function(){
    this.status = 'playing';
};

Room.prototype.addPlayer = function(player){
    this.players.push(player);
};

Room.prototype.getPlayer = function(UID){
    if(this.players.length){
        for(var i = 0; i<=this.players.length - 1; i++){
            if(this.players[i].UID == UID){
                var player = this.players[i];
                if(player instanceof Player){
                    return player;
                } else {
                    player.__proto__ = Player.prototype;
                    return player;
                }
            }
        }
    }

    return false;
};

Room.prototype.removePlayerByUID = function(UID){
    if(this.players.length){
        for(var i = 0; i<=this.players.length - 1; i++){
            if(this.players[i].UID === UID){
                this.players.splice(i, 1);
                return true;
            }
        }
    }

    return false;
};

Room.prototype.newRound = function(){
    this.games += 1;
};

Room.prototype.isAuthorized = function(){
    // Start with no password
};


var Rooms = function(){
    this.rooms = [];
};

Rooms.prototype.addRoom = function(roomId){
    var newRoom = new Room(roomId);
    this.rooms.push(newRoom);
    return newRoom;
};

Rooms.prototype.deleteRoom = function(roomId){
    if(this.rooms.length){
        for(var i = 0; i<=this.rooms.length - 1; i++){
            if(this.rooms[i].id == roomId){
                this.rooms.splice(i, 1);
                return true;
            }
        }
    }

    return false;
};

Rooms.prototype.getRooms = function(){
    var rooms = storage.getItemSync('rooms');
    if(rooms){
        this.rooms = rooms.rooms;
    } else {
        storage.setItem('rooms', new Rooms());
    }
};

Rooms.prototype.isExist = function(roomId){
    for(var i = 0; i<=this.rooms.length - 1; i++){
        if(this.rooms[i].id == roomId){
            return true;
        }
    }

    return false;
};

Rooms.prototype.getRoom = function(roomId){
    for(var i = 0; i<=this.rooms.length - 1; i++){
        if(this.rooms[i].id == roomId){
            var room = this.rooms[i];
            if(room instanceof Room){
                return room;
            } else {
                room.__proto__ = Room.prototype;
                return room;
            }
        }
    }

    return false;
};

Rooms.prototype.save = function(){
    storage.setItem('rooms', this);
};

Rooms.prototype.getPlayerBySocketId = function(socketId){
    for(var i = 0; i<=this.rooms.length - 1; i++){
        for(var j = 0; j<=this.rooms[i].players.length - 1; j++){
            if(this.rooms[i].players[j].socketId == socketId){
                var player = this.rooms[i].players[j];
                if(player instanceof Player){
                    return player;
                } else {
                    player.__proto__ = Player.prototype;
                    return player;
                }
            }
        }
    }

    return false;
};

var rooms = new Rooms();
rooms.getRooms();

var minutes = 0.2, theInterval = minutes * 60 * 1000;
setInterval(function() {
    console.log('Save rooms data');
    rooms.save();
}, theInterval);
/**
 * Create room from home page
 */
app.post('/room', function(req, res){
    var roomId = req.body.room;
    // connection.query("select * from room where number = " + room, function(err, rows, fields){
    //    if(rows && rows.length > 0){
    //        /**
    //         * If room exists, Insert player into that room, then redirect to that room
    //         */
    //
    //        var playerObj = {room_id: room, nick_name: randomNick()};
    //        connection.query('INSERT INTO player SET ?', playerObj, function(err, result) {
    //            if(!err){
    //                res.redirect('/room/' + room);
    //            }
    //        });
    //
    //    } else {
    //        /**
    //         * Room not exist, we create a new room
    //         */
    //        var newRoomObj  = {password: null, hash: null, number: randomRoom()};
    //        var createNewRoom = connection.query('INSERT INTO room SET ?', newRoomObj, function(err, result) {
    //
    //            if(!err){
    //                /**
    //                 * Insert player into that room
    //                 */
    //                var playerObj = {room_id: result.insertId, nick_name: randomNick()};
    //                connection.query('INSERT INTO player SET ?', playerObj, function(err, result) {
    //                    res.redirect('/room/' + randomRoom);
    //                });
    //            }
    //        });
    //
    //    }
    // });

    res.redirect('/room/' + room.id);
});

// var deletePlayer = function(connection, socketId,  callback){
//     connection.query("delete from player where socket_id = ? ", socketId, function(err, result){
//         callback(err, result);
//     });
// };
//
// var getPlayers = function(connection, roomId,  callback){
//     connection.query("select * from player where room_id = ? ", roomId, function(err, result){
//         callback(err, result);
//     });
// };
//
// var updatePlayer = function(connection, playerId, updateObj, callback){
//     connection.query("update player set ? where id = ? ",[updateObj, playerId], function(err, result){
//         callback(err, result);
//     });
// };
//
// var insertPlayer = function(connection, playerObj, callback){
//     connection.query('INSERT INTO player SET ?', playerObj, function(err, result) {
//         if(!err){
//             callback(err, result);
//         }
//     });
// };

// var getPlayersData = function(connection, roomId, callback){
//     getPlayers(connection, roomId, function(err, result){
//         if(result){
//             var players = [];
//
//             for(var i = 0; i<= result.length - 1; i++){
//                 var player = {};
//                 player['nick_name'] = result[i]['nick_name'];
//                 player['ready'] = result[i]['ready'];
//                 player['id'] = result[i]['id'];
//
//                 players.push(player);
//             }
//
//             callback(players);
//         }
//     });
// };

io.on('connection', function(socket){

    /**
     * Front-end emit room event when player join a room
     */
    socket.on('join', function(obj){

        socket.join('room_' + obj.roomId);
        var room = rooms.getRoom(obj.roomId);

        if(!room){
            return null;
        }

        var player = room.getPlayer(obj.playerUID);

        if(!player){
            return null;
        }

        player.updateLeaveStatus(false);
        player.updateSocket('/#' + obj.socketId);
        socket.to('room_' + obj.roomId).emit('updatePlayers', room.players);
    });

    // socket.on('refresh', function(data){
    //     updatePlayer(connection, data.userId, {socket_id: '/#' + data.socketId}, function(err, result){
    //         console.log('got refresh', data);
    //         socket.join('room_' + data.roomId);
    //         getPlayersData(connection, data.roomId, function(players){
    //             socket.to('room_' + data.roomId).emit('updatePlayers', players);
    //         });
    //     });
    // });

    // socket.on('ready', function(req){
    //     console.log('ready', req);
    //     var roomId = req['room_id'];
    //     var playerId = req['player_id'];
    //     var ready = req['ready'];
    //     console.log('update player is ready');
    //
    //     /**
    //      * Update database set player ready
    //      */
    //     updatePlayer(connection, playerId, {ready: ready}, function(err, result){
    //         socket.to('room_' + roomId).emit('player_ready', playerId);
    //     });
    //
    // });

    socket.on('disconnect', function(){
        var player = rooms.getPlayerBySocketId(socket.id);
        if(!player){
            return null;
        }

        player.updateLeaveStatus(true);
        console.log(player);
        setTimeout(function () {
            console.log('timeout player', player);
        }, 5000);
    });
});


app.get('/room/:id', function(req, res){
    var roomId = req.params.id;
    var cookieContents = req.cookies;
    var room = null;
    var exist = false;
    var existPlayer = false;
    var player = new Player();

    if(rooms.isExist(roomId)){
        room = rooms.getRoom(roomId);
        exist = true;
    } else {
        room = rooms.addRoom(roomId);
    }

    if(cookieContents.dice !== undefined){
        var content = JSON.parse(cookieContents.dice);
        if(content.player !== undefined && content.player.UID !== undefined){
            var playerResult = room.getPlayer(content.player.UID);
            if(playerResult){
                player = playerResult;
                console.log('existing player');
                existPlayer = true;
            }
        }
    }

    if(!exist){
        player.updateOwner();
    }

    if(!existPlayer){
        room.addPlayer(player);
    }

    console.log('rooms', rooms);

    res.render('room', {roomId: roomId, player: player});
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});