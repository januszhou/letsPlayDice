--JUL 13

CREATE TABLE room (
  id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  password VARCHAR(255),
  hash VARCHAR(255),
  player_num INT(5)
)

CREATE TABLE player (
  id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nick_name VARCHAR(255),
  socket_id VARCHAR(255)
)