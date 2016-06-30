'use strict';

const mysql = require('mysql');
const q = require('q');
const async = require('async-q');

const connection = mysql.createConnection('mysql://root@amigenlocalhost/sysfisio');