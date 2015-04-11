var names = require("./names.js");
var MAX_USERS_IN_ROOM = 30;
var MAX_USERS_IN_GAMEROOM = 10;
var KICKBAN_MIN_REP = 50;             // Reputation required to kickban
var REQUIRED_REP_DIFFERENCE = 20;     // Required reputation difference to be allowed to kickban someone

function Protocol (io, drawtogether, imgur) {
	this.io = io;
	this.drawTogether = drawtogether;
	this.imgur = imgur;
	this.bindIO();
	setInterval(this.updateInk.bind(this),  30 * 1000);
	setInterval(this.updateAllPlayerLists.bind(this), 10 * 60 * 1000);
}

Protocol.prototype.sendChatMessage = function sendChatMessage (room, data) {
	console.log("[CHAT][" + room + "] " + data.user + ": " + data.message);
	this.io.to(room).emit("chatmessage", data);
	this.drawTogether.addChatMessage(room, data);
};

Protocol.prototype.sendDrawing = function sendDrawing (room, socketid, drawing) {
	this.io.to(room).emit("drawing", {socketid: socketid, drawing: drawing});
};

Protocol.prototype.getUserCount = function getUserCount (room) {
	return Object.keys(this.io.nsps['/'].adapter.rooms[room] || {}).length;
};

Protocol.prototype.getPublicRooms = function getPublicRooms () {
	var rooms = [];
	for (var sKey = 0; sKey < this.io.sockets.sockets.length; sKey++) {
		var found = false;
		for (var rKey = 0; rKey < rooms.length; rKey++) {
			if (this.io.sockets.sockets[sKey].room == rooms[rKey].room) {
				rooms[rKey].users++;
				found = true;
				break;
			}
		}

		if (found) continue;

		rooms.push({
			room: this.io.sockets.sockets[sKey].room,
			users: 1
		});
	}

	return rooms;
};

Protocol.prototype.addDrawing = function addDrawing (socket, drawing, callback) {
	// Check if the socket has more than 0 ink, if so add the drawing and inform the room
	this.drawTogether.getInkFromIp(socket.ip, function (err, amount) {
		if (err) {
			console.error("[DRAWING][GETINKERROR]", err);
			return;
		}

		if (amount < 0) {
			socket.emit("chatmessage", {
				user: "SERVER",
				message: "NO INK"
			});
			socket.emit("setink", amount);
			callback();
			return;
		}

		this.drawTogether.addDrawing(socket.room, drawing, function (err) {
			if (!err) {
				this.drawTogether.lowerInkFromIp(drawing, socket.ip, function (err) {
					if (err)
						console.log("[DRAWING][INKERROR]", err);
				});
				this.sendDrawing(socket.room, socket.id, drawing);
			} else {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: err
				});
			}

			callback();
		}.bind(this));
	}.bind(this));
};

Protocol.prototype.addDrawingNoInk = function addDrawingNoInk (socket, drawing, callback) {
	// Add the drawing and inform the room

	this.drawTogether.addDrawing(socket.room, drawing, function (err) {
		if (!err) {
			this.sendDrawing(socket.room, socket.id, drawing);
		} else {
			socket.emit("chatmessage", {
				user: "SERVER",
				message: err
			});
		}

		callback();
	}.bind(this));
};

Protocol.prototype.updateInk = function updateInk () {
	// Add ink for all online clients

	var ids = []; // User ids of all logged in sockets
	var ips = []; // Ip addresses of all the sockets

	for (var sKey = 0; sKey < this.io.sockets.sockets.length; sKey++) {
		if (ids.indexOf(this.io.sockets.sockets[sKey].userid) == -1)
			ids.push(this.io.sockets.sockets[sKey].userid);
	}

	// For the logged in sockets, get the reputation
	this.drawTogether.getReputationsFromUserIds(ids, function (err, rows) {
		if (err) {
			console.error("[UPDATE INK][ERROR]", err);
			this.io.emit("chatmessage", {
				user: "SERVER",
				message: "Something went wrong while refilling the ink!"
			});
			return;
		}

		var minAmount = 1500;
		var amountPerRep = 200;

		for (var sKey = 0; sKey < this.io.sockets.sockets.length; sKey++) {
			var socket = this.io.sockets.sockets[sKey];
			var extraAmount = 0;

			// Don't allow two ips to get ink multiple times
			if (ips.indexOf(socket.ip) !== -1) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "Multiple users are online from this ip, this means you share the same ink!"
				});
				socket.emit("changeink", minAmount);
				continue;
			}
			ips.push(socket.ip);

			// User is logged in, see how much reputation he has
			if (socket.userid) {
				var found = false;
				for (var k = 0; k < rows.length; k++) {
					if (rows[k].to_id == socket.userid) {
						extraAmount = rows[k].reputation * amountPerRep + minAmount;
						found = true;
						break;
					}
				}
			}

			// User is not logged in or reputation was not found
			this.drawTogether.raiseInkFromIp(minAmount + extraAmount, socket.ip, function (socket, amount, err) {
				if (err) {
					console.log("[UPDATEINK][ERROR]", err);
					return;
				}

				socket.emit("changeink", amount);
			}.bind(this, socket, minAmount + extraAmount));
		}
	}.bind(this));
};

Protocol.prototype.getPlayerNameList = function getPlayerNameList (room, callback) {
	// Callback gets err as first param, if success returns null
	// Second argument is array of objects of the form {
	//     id: socketid,
	//     name: username,
	//     reputation: accountrep //optional
	// }
	var sroom = this.io.nsps['/'].adapter.rooms[room];
	var ids = [];

	for (var id in sroom) {
		var socket = this.socketFromId(id);
		if (typeof socket.userid == "number") ids.push(socket.userid);
	}

	// For the logged in sockets, get the reputation
	this.drawTogether.getReputationsFromUserIds(ids, function (err, rows) {
		if (typeof rows !== "object" || typeof rows.length !== "number") rows = [];

		var sroom = this.io.nsps['/'].adapter.rooms[room];
		var players = [];
		var found_rep = false;

		for (var id in sroom) {
			var socket = this.socketFromId(id);
			if (typeof socket.userid == "number") {
				// User is logged in, find the reputation
				var found_rep = false;
				for (var k = 0; k < rows.length; k++) {
					if (rows[k].to_id == socket.userid) {
						players.push({
							id: socket.id,
							name: socket.username,
							reputation: rows[k].reputation
						});
						found_rep = true;
						break;
					}
				}
				if (found_rep) continue;
				// User is logged in but no reputation
				players.push({
					id: socket.id,
					name: socket.username
				});
			} else {
				players.push({
					id: socket.id,
					name: socket.username,
					reputation: 0
				});
			}
		}

		// Return back
		callback(null, players);
	}.bind(this));
};

Protocol.prototype.updateAllPlayerLists = function updateAllPlayerLists () {
	// Send all clients every player in the room every so often
	// This helps prevent out of sync player lists
	var roomsDone = {};
	for (var sKey = 0; sKey < this.io.sockets.sockets.length; sKey++) {
		var room = this.io.sockets.sockets[sKey].room;
		if (!roomsDone[room]) {
			this.getPlayerNameList(room, function (err, list) {
				if (err) {
					console.error("[UPDATEALLPLAYERLIST][PLAYERLIST][ERROR]", err, socket.room);
					return;
				}
				this.io.to(room).emit("playerlist", list);
			}.bind(this));
		}
	}
};

Protocol.prototype.socketFromId = function socketFromId (id) {
	return this.io.nsps['/'].connected[id];
};

Protocol.prototype.bindIO = function bindIO () {
	var protocol = this;
	var manualIpBanList = ["86.24.220.131", "79.141.162.19", "62.210.94.133", "69.158.148.224", "68.59.94.92", "99.9.208.208", "65.94.35.239", "72.8.184.30", "174.59.77.94", "24.149.10.200"];
	// Banned people: First two ips: Guy called himself "SERVER", annoying person, draws big brushes over others to grief
	// Next two: Drew big red swastikas
	// Next: Holohoax: drawing swastikas
	// Next: The EJACULATOR: constant joining and disconnecting
	// Next: retardchu: drawing swastikas
	// Next: Cheesemaster: drawing swastikas, penis
	// Next: Starlord: drawing swastikas, penisses and removing drawings
	// Next: Swastika and penis
	this.io.on("connection", function (socket) {
		// Give the user a name and send it to the client, then bind
		// all events so we can answer the client when it asks something

		socket.ip = socket.client.conn.remoteAddress;
		if (!socket.ip) {
			socket.emit("chatmessage", {
				user: "SERVER",
				message: "No ip found!"
			});
			socket.disconnect();
		}

		if (manualIpBanList.indexOf(socket.ip) !== -1) {
			socket.emit("chatmessage", {
				user: "SERVER",
				message: "You have been banned."
			});
			socket.disconnect();
		}

		protocol.drawTogether.isBanned(socket.ip, function (err, banned, time) {
			if (err) {
				console.error("Error checking if banned on connect", err);
				return;
			}

			if (banned) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "You have been banned till " + time
				});
				console.log("[BANNED] " + socket.ip + " tried to join.");
				socket.disconnect();
			}
		});

		socket.username = names[Math.floor(Math.random() * names.length)] + " " + names[Math.floor(Math.random() * names.length)];
		socket.emit("initname", socket.username);

		console.log("[CONNECTION] " + socket.ip);

		socket.on("chatmessage", function (message) {
			// User is trying to send a message, if he is in a room
			// send the message to all other users, otherwise show an error

			if (!message) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: message
				});
				return;
			}

			if (!socket.room) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "You can't chat when not in room."
				});
				return;
			}

			if (Date.now() - socket.lastMessage < 1000) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "Don't send messages too fast!."
				});
				return;
			}

			socket.lastMessage = Date.now()

			protocol.sendChatMessage(socket.room ,{
				user: socket.username,
				message: message
			});
		});

		socket.on("uploadimage", function (base64, callback) {
			if (Date.now() - socket.lastImgurUpload < 2000) {
				return;
			}
			socket.lastImgurUpload = Date.now();
			console.log("Imgur upload request from " + socket.ip);

			callback = callback || function () {};
			protocol.imgur.uploadBase64(base64)
			.then(function (json) {
				console.log("[IMAGE UPLOAD] " + socket.ip + " " + json.data.link);
				callback({
					url: json.data.link
				});
			})
			.catch(function (err) {
				console.error("[IMAGE UPLOAD][ERROR] " + socket.ip + " " + err.message);
				callback({
					error: "Something went wrong while trying to upload the file to imgur."
				});
			});
		});

		socket.on("getrooms", function (callback) {
			if (!callback) return;
			callback(protocol.getPublicRooms());
		});

		socket.on("login", function (data, callback) {
			if (typeof callback !== "function")
				callback = function () {}

			// We are first going to try to login, if that fails we will check
			// if the account exists.
			// Exists? => register and log in
			// Else => warn wrong password
			protocol.drawTogether.login(data, function (err, success, id, rep) {
				if (err) {
					callback({error: "Some error occured! [Login Check Error]"});
					console.log("[LOGIN][ERROR] ", err);
					return;
				}

				if (!success) {
					protocol.drawTogether.accountExists(data.email, function (err, exists) {
						if (err) {
							callback({error: "Some error occured! [Login Exists Error]"});
							console.log("[LOGIN][ERROREXISTS] ", err);
							return;
						}

						if (!exists) {
							protocol.drawTogether.register(data, function (err) {
								if (err) {
									console.log("[REGISTER][ERROR]", err, data);
									callback({error: "An error occured while trying to register, please wait a few hours for the issue to be resolved."});
									return;
								}

								protocol.drawTogether.login(data, function (err, success, id, rep) {
									if (err) {
										callback({error: "Some error occured! [Login After Register Error]"});
										console.log("[LOGINAFTERREGISTER][ERROR] ", err);
										return;
									}

									if (!success) {
										console.log("Failed to login " + data.email + " after just registering it.", data)
										callback({error: "Unkown error. Failed to login after register."});
										return;
									}

									callback({success: "Registered and logged in to " + data.email, reputation: rep});
									console.log("[REGISTER] " + socket.ip + " registered " + data.email);
									socket.userid = id;
								});
							});
						} else {
							callback({error: "Wrong password!"});
						}
					});
					return;
				}

				callback({success: "Logged in as " + data.email, reputation: rep});
				console.log("[LOGIN] " + socket.ip + " logged in as " + data.email + " (" + id + ")");
				socket.userid = id;

				protocol.drawTogether.isBanned(socket.userid, function (err, banned, time) {
					if (err) {
						console.error("Error checking if banned on login", err);
						return;
					}

					if (banned) {
						socket.emit("chatmessage", {
							user: "SERVER",
							message: "You have been banned till " + time
						});
						console.log("[BANNED] " + socket.userid + " tried to join.");
						socket.disconnect();
					}
				});

				protocol.drawTogether.getReputationFromUserId(id, function (err, reputation) {
					if (err) {
						console.error("[LOGIN][GETREPUTATION]", err);
						return;
					}

					protocol.io.to(socket.room).emit("reputation", {
						id: socket.id,
						reputation: reputation
					});
				});
			});
		});

		socket.on("upvote", function (socketid) {
			var targetSocket = protocol.socketFromId(socketid);

			if (!targetSocket) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "No user logged in with this socket id."
				});
				return;
			}

			if (typeof socket.userid !== "number") {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "You can only give someone positive reputation when you are logged in!"
				});
				return;
			}

			if (typeof targetSocket.userid !== "number") {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "Ugh, " + targetSocket.username + " isn't logged in!"
				});

				targetSocket.emit("chatmessage", {
					user: "SERVER",
					message: socket.username + " tried giving you positive reputation but you aren't logged in :( #sadlife"
				});

				return;
			}

			if (socket.userid == targetSocket.userid) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "You can't give yourself reputation!"
				});
				return;
			}

			protocol.drawTogether.vote(socket.userid, targetSocket.userid, function (err, success) {
				if (err) {
					console.error("[VOTE][VOTEERROR]", err);
					socket.emit("chatmessage", {
						user: "SERVER",
						message: "An error occured while trying to vote."
					});
					return;
				}

				if (!success) {
					socket.emit("chatmessage", {
						user: "SERVER",
						message: "You already gave " + targetSocket.username + " reputation."
					});
					return;
				}

				protocol.sendChatMessage(socket.room, {
					user: "SERVER",
					message: socket.username + " gave " + targetSocket.username + " positive reputation! :D"
				});
	
				protocol.drawTogether.getReputationFromUserId(targetSocket.userid, function (err, reputation) {
					if (err) {
						console.error("[LOGIN][GETREPUTATION]", err);
						return;
					}

					protocol.io.to(socket.room).emit("reputation", {
						id: targetSocket.id,
						reputation: reputation
					});
				});
			});
		});

		socket.on("changename", function (name) {
			// Change the username
			if (name == "S᠎ERVER") {
				manualIpBanList.push(socket.ip);
				console.log("Server guy banned, ip: " + socket.ip);
				socket.disconnect();
			}

			name.replace(/[^\x00-\x7F]/g, "");
			if (name.length > 32)
				name = name.substr(0, 32);

			if (name.toLowerCase().indexOf("server") !== -1) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "Don't steal my name!"
				});
				return;
			}

			if (Date.now() - socket.lastNameChange < 1000) {
				socket.emit("chatemessage", {
					user: "SERVER",
					message: "Don't change your name so often!"
				});
				return;
			}

			console.log("[NAME CHANGE] " + socket.username + " to " + name);
			if (typeof socket.room !== "undefined") {
				protocol.sendChatMessage(socket.room, {
					user: "SERVER",
					message: socket.username + " changed name to " + name
				});
			}

			protocol.io.to(socket.room).emit("playernamechange", {
				id: socket.id,
				oldname: socket.username,
				newname: name
			});

			socket.username = name;
			socket.lastNameChange = Date.now();
		});

		socket.on("drawing", function (drawing, callback) {
			// The client drew something and wants to add it to the room
			// If a valid drawing put it in the database and send it to
			// the reast of the people in the room

			if (typeof callback !== "function")
				callback = function () {};

			if (socket.room.indexOf("private_") == 0)
				protocol.addDrawingNoInk(socket, drawing, callback);
			else
				protocol.addDrawing(socket, drawing, callback);

		});

		socket.on("changeroom", function (room, callback) {
			// User wants to change hes room, subscribe the socket to the
			// given room, tell the user he is subscribed and send the drawing.
			// Return true in callback if the user is now in the room, otherwise return false
			callback = callback || function () {};

			if (socket.room == room) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "You are already in room " + room + "!"
				});
				callback(true);
				return;
			}

			if (protocol.getUserCount(room) >= MAX_USERS_IN_ROOM && socket.username !== "UberLord") {
				socket.emit("chatmesage", {
					user: "SERVER",
					message: "Can't join room " + room + " too many users!"
				});
				callback(false);
				return;
			}

			console.log("[ROOM CHANGE] " + socket.username + " changed from " + socket.room + " to " + room + " there are now " + protocol.getUserCount(room) + " people here.");


			protocol.io.to(socket.room).emit("leave", {id: socket.id});
			socket.leave(socket.room);
			socket.join(room);
			socket.room = room;

			if (socket.userid) {
				protocol.drawTogether.getReputationFromUserId(socket.userid, function (err, rep) {
					if (err) {
						console.log("[JOIN][REPERROR]" + err);
						protocol.io.to(socket.room).emit("join", {
							id: socket.id,
							name: socket.username,
							reputation: 0
						});
						return;
					}
					protocol.io.to(socket.room).emit("join", {
						id: socket.id,
						name: socket.username,
						reputation: rep
					});
				});
			} else {
				protocol.io.to(socket.room).emit("join", {
					id: socket.id,
					name: socket.username,
					reputation: 0
				});
			}
			
			socket.emit("chatmessage", {
				user: "SERVER",
				message: "Changed room to " + room + ", loading drawings..."
			});

			protocol.drawTogether.getDrawings(room, function (err, drawings) {
				if (err) {
					socket.emit("chatmessage", {
						user: "SERVER",
						message: err
					});
					drawings = [];
				}

				socket.emit("drawings", {
					room: socket.room,
					drawings: drawings
				});

				protocol.getPlayerNameList(socket.room, function (err, list) {
					if (err) {
						console.error("[JOIN][PLAYERLIST][ERROR]", err, socket.room);
						socket.emit("playerlist", list);
						return;
					}
					socket.emit("playerlist", list)
				});
			});

			protocol.drawTogether.getInkFromIp(socket.ip, function (err, amount) {
				socket.emit("setink", amount);
			});

			callback(true);
		});

		socket.on("kickban", function (options, callback) {
			// Options = [socketid, minutes, bantype]
			callback = callback || function () {};
			var targetSocket = protocol.socketFromId(options[0]);

			if (!targetSocket) {
				callback({error: "No user online with this socketid"});
				return;
			}

			if (typeof socket.userid !== "number") {
				callback({error: "You can only kickban someone if you are logged in!"});
				return;
			}

			protocol.drawTogether.getReputationFromUserId(socket.userid, function (err, rep) {
				if (err) {
					callback({error: "An error occured while trying to get your reputation."});
					console.error("[KICKBAN][ERROR] KICKBAN GET OWN REP", err);
					return;
				}

				if (rep < KICKBAN_MIN_REP) {
					callback({error: "You need at least " + KICKBAN_MIN_REP + " reputation to kickban someone."});
					console.error("[KICKBAN][ERROR] " + socket.userid + " tried to ban " + targetSocket.userid + " but only had " + rep + " reputation.");
					return;
				}

				protocol.drawTogether.getReputationFromUserId(targetSocket.userid, function (err, targetrep) {
					if (err) {
						callback({error: "An error occured while trying to get target reputation."});
						console.error("[KICKBAN][ERROR] KICKBAN GET TARGET REP", err);
						return;
					}

					if (rep - targetrep < REQUIRED_REP_DIFFERENCE) {
						callback({error: "You need to have at least " + REQUIRED_REP_DIFFERENCE + " more reputation than the person you are trying to kickban."});
						console.error("[KICKBAN][ERROR] " + socket.userid + " (rep: " + rep + ") tried to ban " + targetSocket.userid + " (rep: " + targetrep + ") rep difference " + (rep - targetrep) + " required " + REQUIRED_REP_DIFFERENCE);
						return;
					}

					if (options[2] == "account" || options[2] == "both") {
						protocol.kickban(targetSocket.userid, function (err, success) {
							if (err) {
								callback({error: "Kickban failed."});
								console.error("[KICKBAN][ERROR] Kickban account", err);
								return;
							}

							if (options[2] == "both") {
								protocol.kickban(targetSocket.ip, function (err, success) {
									if (err) {
										callback({error: "Kickban of ip failed but account kickban was successful."});
										console.error("[KICKBAN][ERROR] Kickban ip", err);
										return;
									}

									callback({success: "Kickbanned account " + targetSocket.userid + " and ip " + targetSocket.ip});
									console.log("[KICKBAN] Account " + targetSocket.userid + " and ip " + targetSocket.ip + " have been banned for " + options[1] + " minutes by " + socket.userid);
								});
							} else {
								callback({success: "Kickbanned account " + targetSocket.userid});
								console.log("[KICKBAN] Account " + targetSocket.userid + " has been banned for " + options[1] + " minutes by " + socket.userid);
							}
						});
					} else if (options[2] == "ip") {
						protocol.kickban(targetSocket.ip, function (err, success) {
							if (err) {
								callback({error: "Kickban of ip failed"});
								console.error("[KICKBAN][ERROR] Kickban of ip failed", err);
								return;
							}

							callback({success: "Kickbanned ip " + targetSocket.ip});
							console.log("[KICKBAN] Ip " + targetSocket.ip + " has been banned for " + options[1] + " minutes by " + socket.userid);
						});
					}
				});
			});
		});

		socket.on("executejs", function (code) {
			// Execute code if perm flag for code exec is set
			if (false) {
				eval(code);
			}
		});

		socket.on("disconnect", function () {
			protocol.io.to(socket.room).emit("leave", { id: socket.id });
		});
	});
};

module.exports = Protocol;