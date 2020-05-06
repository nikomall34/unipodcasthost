const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const bodyParser = require("body-parser");
const fs = require("fs");
const fileUpload = require("express-fileupload");
const RSS = require('rss-generator');
const Parser = require('rss-parser');
const app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

//support parsing of application/x-www-form-urlencoded post data
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

app.set('view engine', 'pug');

ffmpeg.setFfmpegPath("/usr/bin/ffmpeg");
ffmpeg.setFfprobePath("/usr/bin/ffprobe");
ffmpeg.setFlvtoolPath("/usr/bin/ffplay");

var feed;
const servername = "localhost:8080";
const vorlesungsname = "test";

// generate page from view
app.get('/', function (req, res) {
  // create directory for new playlist
  const folderName = `${__dirname}/public/${req.query.id}`;
  const rsspath = `http://${servername}/public/${vorlesungsname}/rss.xml`;
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName);
    feed = new RSS({
      title: `${req.query.id}`, //TODO Titel in html form
      feed_url: rsspath,
      site_url: `http://${servername}`
    });
    //res.status(200).send(`http://${servername}/public/${vorlesungsname}/rss.xml`);
  }
  else {
    var parser = new Parser();
    feed = parser.parseURL(rsspath);
  }

  res.render('index', { 
    id: req.query.id,
    rsspath: rsspath
  });
});

app.use("/", express.static(__dirname + '/public'));

/* hier könnte man die feeds speichern
let feeds = {
  "mertensgeheimerordner": null
};*/

app.post("/convert", (req, res) => {
  let file = req.files.file;
  // TODO make sure file actually contains an extension
  let fileName = `${file.name.split('.').slice(0, -1).join('.')}.mp3`; // replace file extension with mp3
  // save video file to tmp directory
  file.mv("tmp/" + file.name, function (err) {
    if (err) return res.sendStatus(500).send(err);
    console.log("File Uploaded successfully");
  });
  // convert to mp3
  ffmpeg("tmp/" + file.name)
    .noVideo()
    .audioCodec('libmp3lame')
    .saveToFile(`${__dirname}/public/${req.query.id}/${fileName}`)
    .on("end", function (stdout, stderr) {
      console.log("Finished");

      // TODO Feed aktualisieren
      feed.item({
        title: 'title', //html form
        enclosure: { url: `http://${servername}/public/${vorlesungsname}/${fileName}`}
      });
      var xml = feed.xml();
      fs.writeFile(`${folderName}/rss.xml`, xml); //TODO foldername global
      
      // redirect to converted audio file
      res.redirect(`${req.baseUrl}/${req.query.id}/${fileName}`);


      // remove video file
      fs.unlink("tmp/" + file.name, function (err) {
        if (err) throw err;
        console.log("File deleted");
      });
    })
    .on("error", function (err) {
      console.log("an error happened: " + err.message);
      // remove video file
      fs.unlink("tmp/" + file.name, function (err) {
        if (err) throw err;
        console.log("File deleted");
      });
    })
});

app.listen(8080);
