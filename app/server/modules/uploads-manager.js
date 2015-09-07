
var MongoDB = require('mongodb').Db;
var Server = require('mongodb').Server;
var moment = require('moment');

var dbPort = 27017;
var dbHost = 'localhost';
var dbName = 'frontapp';

///////////////////////////////////////
// establish the database connection //
///////////////////////////////////////
var db = new MongoDB(dbName, new Server(dbHost, dbPort, {auto_reconnect: true}), {w: 1});

db.open(function (e, d) {
    if (e) {
        console.log(e);
    } else {
        console.log('upload manager connected to database :: ' + dbName);
    }
});

var uploaded_files = db.collection('uploaded_files');

///////////////
//  METHODS  //
///////////////
exports.insert_user_uploaded_file = function (file_data, username, callback)
{
    var newData = {};

    uploaded_files.findOne({filename: file_data.name, username: username}, function (e, o) {
        if (o === null) {
            newData.filename = file_data.name;
            newData.username = username;
            newData.file_data = file_data;

            newData.time = new Date();
            newData.time = newData.time.getTime();

            // append date stamp when record was created //
            newData.date = moment().format('MMMM Do YYYY, h:mm:ss a');

            uploaded_files.insert(newData, {safe: true}, callback);
        } else {
            callback(null);
        }
    });
};

exports.get_uploaded_files_by_username = function (username, callback) {
    uploaded_files.find({username: username}).toArray(
            function (e, results) {
                if (e)
                    callback(e);
                else
                    callback(results);
            });
};

exports.delete_image = function (filename, callback) {
    uploaded_files.remove({filename: filename}, callback);
};

