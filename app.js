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
    this.doubt = false;
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

Player.prototype.updateReady = function(){
    this.ready = !this.ready;
};

Player.prototype.createRound = function(){
    var getRandomArbitrary = function(min, max) {
        return Math.floor(Math.random() * (max - min) + min);
    };

    var round = [];

    for(var i = 0; i <= 4; i++){
        round.push(getRandomArbitrary(1, 6));
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
    this.roundResult = false;
};

Room.prototype.start = function(){
    this.status = 'playing';
    for(var i = 0; i <= this.players.length - 1; i++){
        this.players[i].createRound();
        this.players[i].ready = false;
    }

    this.roundResult = {
        summary: {
            dice1: 0,
            dice2: 0,
            dice3: 0,
            dice4: 0,
            dice5: 0,
            dice6: 0
        },
        detail:{

        }
    };

    for(i = 0; i <= this.players.length - 1; i++){
        var player = this.players[i];

        this.roundResult.detail[player.nickName] = {dice1: 0, dice2: 0, dice3: 0, dice4: 0, dice5: 0, dice6: 0};

        for(var j = 0; j <= player.round.length - 1; j++){
            var dice = player.round[j];
            this.roundResult.summary['dice' + dice] += 1;
            this.roundResult.detail[player.nickName]['dice' + dice] += 1;
        }
    }

    this.games += 1;
};

/**
 * Reset round
 */
Room.prototype.result = function(){
    this.status = 'result';
};

Room.prototype.resetRound = function(){
    this.status = 'waiting';
    for(var i = 0; i <= this.players.length - 1; i++){
        this.players[i].round = [];
    }

    /**
     * TODO: reset everyone ready to false
     */
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

Room.prototype.findOrAssignOwner = function(){
     var isFindOwner = false;

    for(var i = 0; i<=this.players.length - 1; i++){
        if(this.players[i].owner){
            isFindOwner = true;
            return this.players[i];
        }
    }

    if(!isFindOwner){
        if(this.players.length){
            this.players[0].owner = true;
            return this.players[0];
        }
    }
};

Room.prototype.isReady = function(){
    for(var i = 0; i<=this.players.length - 1; i++){
        if(!this.players[i].ready){
            return false;
        }
    }

    return true;
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
                var room = this.rooms[i];
                if(room instanceof Room){
                    // nothing
                } else {
                    room.__proto__ = Room.prototype;
                }

                var player = this.rooms[i].players[j];
                if(player instanceof Player){
                    // nothing
                } else {
                    player.__proto__ = Player.prototype;
                }

                return {room: room, player: player};
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
    res.redirect('/room/' + roomId);
});

io.on('connection', function(socket){

    var updatePlayer = function(roomId, option){
        option = option || {};

        var defaultOption = {
            onlySender: false,
            broadcast: false,
            player: null,
            new: false,
            ready: false,
            start: false
        };

        underscore.extend(defaultOption, option);

        var room = rooms.getRoom(roomId);
        if(!room){
            return null;
        }

        /**
         * Before we update players, we assign owner
         */
        room.findOrAssignOwner();

        if(option.onlySender){
            io.to(socket.id).emit('updatePlayers', room);
        } else if(option.broadcast) {
            socket.to('room_' + roomId).emit('updatePlayers', room);
        } else if(option.player){
            if(option.ready){
                io.in('room_' + roomId).emit('playerReady', option.player);
            }

            if(option.new){
                socket.to('room_' + roomId).emit('newPlayer', option.player);
            }

            if(option.start){
                io.in('room_' + roomId).emit('allReady', option.player);
            }

        } else {
            io.in('room_' + roomId).emit('updatePlayers', room);
        }
    };
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

        updatePlayer(obj.roomId);
    });

    socket.on('ready', function(req){
        console.log('ready', req);
        var roomId = req['room_id'];
        var playerId = req['player_id'];

        var room = rooms.getRoom(roomId);
        var player = room.getPlayer(playerId);

        player.updateReady();

        updatePlayer(roomId, {player: player, ready: true});

        if(room.isReady()){
            io.in('room_' + roomId).emit('allReady');
        } else {
            io.in('room_' + roomId).emit('allNotReady');
        }

    });

    socket.on('gameStart', function(req){
        var room = rooms.getRoom(req.roomId);

        if(!room){
            return null;
        }

        /**
         * TODO: Validate all player ready status
         */

        room.start();

        updatePlayer(req.roomId);

    });

    socket.on('gameResult', function(req){
        var room = rooms.getRoom(req.roomId);

        if(!room){
            return null;
        }

        var doubter = room.getPlayer(req.doubter);
        doubter.doubt = true;

        room.result();

        updatePlayer(req.roomId);
    });

    socket.on('gameRestart', function(req){
        var room = rooms.getRoom(req.roomId);

        if(!room){
            return null;
        }

        room.resetRound();

        updatePlayer(req.roomId, {onlySender: true});
    });

    socket.on('disconnect', function(){
        var mixData = rooms.getPlayerBySocketId(socket.id);
        if(!mixData.player){
            return null;
        }

        mixData.player.updateLeaveStatus(true);
        setTimeout(function () {
            if(mixData.player.leave){
                mixData.room.removePlayerByUID(mixData.player.UID);
                updatePlayer(mixData.room.id);
                console.log('User left');
            }
        }, 2000);
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

    res.render('room', {roomId: roomId, player: player, room: room, newPlayer: !existPlayer});
});

app.get('/foobar', function(req, res){
    res.render('admin', {rooms: rooms});
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});