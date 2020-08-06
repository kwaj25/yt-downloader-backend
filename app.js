const https = require("https");
const express = require("express");
const itags = require("./constants/itags");
const cors = require("cors");
const ytdl = require("ytdl-core");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
const playlists = require("yt-playlist-scraper");
const fs = require("fs");
const path = require("path");
// const ytpl = require("ytpl");
// const dfy = require("dl-from-yt");
// const readline = require("readline");

ffmpeg.setFfmpegPath(ffmpegPath);

const PORT = process.env.PORT || 80;

const app = express();
app.use(cors());
app.use(
  "/.well-known/pki-validation/",
  express.static(path.join(__dirname, ".well-known/pki-validation/"))
);

var key = fs.readFileSync(path.resolve(__dirname, "selfsigned.key"));
var cert = fs.readFileSync(path.resolve(__dirname, "selfsigned.crt"));

var options = {
  key: key,
  cert: cert,
};
// var options = {
//   key: fs.readFileSync(path.resolve(__dirname, "ssl/private.key")),
//   cert: fs.readFileSync(path.resolve(__dirname, "ssl/certificate.crt")),
//   ca: fs.readFileSync(path.resolve(__dirname, "ssl/ca_bundle.crt")),
// };

app.get("/", async (req, res) => {
  res.send("Youtube downloader api works fluently!!!!");
});

app.get("/playlistInfo", async (req, res) => {
  const playListID = req.query.playListID;
  playlists(playListID)
    .then((playListData) => {
      res.send(playListData);
    })
    .catch((err) => console.log(err));
});

app.get("/downloadAudio", async (req, res) => {
  let { url } = req.query;
  let id = ytdl.getURLVideoID(url);
  let stream = ytdl(id, {
    quality: "highestaudio",
  });

  let info = await ytdl.getInfo(id);

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${info.videoDetails.title}.mp3"`
  );

  let start = Date.now();

  ffmpeg(stream).format("mp3").audioBitrate(128).pipe(res, { end: true });
});

app.get("/getInfo", (req, res) => {
  let { url } = req.query;
  let id = ytdl.getURLVideoID(url);
  ytdl.getInfo(id, (err, info) => {
    if (err) {
      console.log(err);
      throw err;
    } else {
      let audioandvideo = ytdl.filterFormats(info.formats, "audioandvideo");
      let videoonly = ytdl.filterFormats(info.formats, "videoonly");
      let video = ytdl.filterFormats(info.formats, "video");
      let audioonly = ytdl.filterFormats(info.formats, "audioonly");

      let thumbnailList = info.videoDetails.thumbnail;

      if (
        thumbnailList &&
        thumbnailList.thumbnails &&
        Array.isArray(thumbnailList.thumbnails)
      ) {
        thumbnailList =
          thumbnailList.thumbnails[thumbnailList.thumbnails.length - 1];
      }

      video = video.filter((video) => {
        if (video.container == "mp4" && itags.includes(video.itag))
          return video;
      });

      let data = {
        audioandvideo,
        videoonly,
        audioonly,
        video,
        title: info.videoDetails.title,
        thumbnail: thumbnailList,
      };
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(data);
    }
  });
});

app.get("/downloadVideo", async (req, res) => {
  let videoURL = req.query.url;
  let itag = req.query.itag;
  let id = ytdl.getURLVideoID(videoURL);

  let info = await ytdl.getInfo(id);
  let videoFormat = ytdl.chooseFormat(info.formats, { quality: String(itag) });

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${info.videoDetails.title}.mp4"`
  );
  ytdl(videoURL, {
    format: videoFormat,
  }).pipe(res);
});

app.listen(PORT, () => console.log(`server is listening at port ${PORT}`));

var server = https.createServer(options, app);
server.listen(443, () => {
  console.log("server starting on port : " + 443);
});
