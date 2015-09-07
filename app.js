
var http = require('http');
var express = require('express');
var session = require('express-session');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');
var errorHandler = require('errorhandler');
var cookieParser = require('cookie-parser');
var MongoStore = require('connect-mongo')(session);
var multer = require('multer');
var func = require('./app/server/functions');
var execSync = require('child_process').execSync;

var app = express();
var port = 3000;

GLOBAL.upload_done = false;
GLOBAL.uploaded_files = [];

/////////////////////////////////////////
// Development and production settings //
/////////////////////////////////////////
var DEV_1 = 'ron-desk';
var DEV_2 = 'roncho-lap';
var PROD = 'ip-172-31-50-92';
var machine_name = String(execSync('hostname')).trim();

GLOBAL.cfg = {
    base_folder: null,
    opencv_folder: null,
    front_results_folder: 'front_results',
    uploads_folder: './app/public/uploads/'
};

switch (machine_name) {
    case DEV_1:
        GLOBAL.cfg.base_folder = '/bigData/code/frontapp/frontalization_API';
        GLOBAL.cfg.opencv_folder = '/bigData/mylibs/opencv-3.0.0-rc1';
        break;

    case DEV_2:
        GLOBAL.cfg.base_folder = '/home/ron/code/lab-code/python_cpp_interface';
        GLOBAL.cfg.opencv_folder = '/home/ron/code/libs/opencv-3.0.0-rc1';
        break;

    case PROD:
        GLOBAL.cfg.base_folder = '/data/code/frontapp/frontalization_API';
        GLOBAL.cfg.opencv_folder = '/data/libs/opencv-3.0.0-rc1';
        break;

    default:
        throw "Uknown machine name: " + "__" + machine_name + "__";
        break;
}

//////////////////////////////////////////
//  Configure Multer (file uploading)   //
//////////////////////////////////////////
app.use(multer({
    dest: GLOBAL.cfg.uploads_folder,
    rename: function (fieldname, filename) {
        // Remove all whitespaces (replace with _) and add a timestamp.
        return filename.replace(/\s+/g, "_") + '_' + Date.now();
    },
    onFileUploadStart: function (file) {
        func.log(file.originalname + ' upload is starting ...');
    },
    onFileUploadComplete: function (file) {
        func.log('uploaded: ' + file.path);
        GLOBAL.uploaded_files.push(file);

        GLOBAL.upload_done = true;
    }
}));

app.set('port', port);
app.set('views', __dirname + '/app/server/views');
app.set('view engine', 'jade');
app.use(favicon(__dirname + '/app/public/img/favicon.ico'));
app.use(cookieParser());

app.use(session({
    secret: 'faeb4453e5d14fe6f6d04637f78077c76c73d1b4',
    proxy: true,
    resave: true,
    saveUninitialized: true,
    store: new MongoStore({host: 'localhost', port: 27017, db: 'frontapp'})
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(require('stylus').middleware({src: __dirname + '/app/public'}));
app.use(express.static(__dirname + '/app/public'));

require('./app/server/routes')(app);

http.createServer(app).listen(app.get('port'), function () {
    func.log('Express server listening on port ' + app.get('port') +
            ' on machine ' + machine_name);
});

/**
 * Boilerplate used:
 * ----------------
 * Node.js Login Boilerplate
 * More Info : https://github.com/braitsch/node-login
 * Copyright (c) 2013-2015 Stephen Braitsch
 **/