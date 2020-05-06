const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const bodyParser = require("body-parser");
const fs = require("fs");
const fileUpload = require("express-fileupload");
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

ffmpeg.setFfmpegPath("/usr/bin/ffmpeg");
ffmpeg.setFfprobePath("/usr/bin/ffprobe");
ffmpeg.setFlvtoolPath("/usr/bin/ffplay");

app.use("/", express.static(__dirname + '/public'));

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
