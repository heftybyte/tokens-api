const Busboy = require('busboy');
const getRawBody = require('raw-body');
const contentType = require('content-type');

module.exports = (path, app) => {
  app.use((req, res, next) => {
    if (typeof req.rawBody === 'undefined' &&
        req.method === 'POST' &&
        req.headers['content-type'].startsWith('multipart/form-data')) {
      getRawBody(req, {
        length: req.headers['content-length'],
        limit: '10mb',
        encoding: contentType.parse(req).parameters.charset,
      }, function(err, string) {
        if (err) return next(err);
        req.rawBody = string;
        next();
      });
    } else {
      next();
    }
  });

  app.use((req, res, next) => {
    if (req.method === 'POST' &&
        req.headers['content-type'].startsWith('multipart/form-data')) {
      const busboy = new Busboy({headers: req.headers});
      let fileBuffer = new Buffer('');
      req.files = {file: []};

      busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        file.on('data', (data) => {
          fileBuffer = Buffer.concat([fileBuffer, data]);
        });

        file.on('end', () => {
          const fileObject = {
            fieldname,
            originalname: filename,
            encoding,
            mimetype,
            buffer: fileBuffer,
          };

          req.files.file.push(fileObject);
          next();
        });
      });

      busboy.end(req.rawBody);
    } else {
      next();
    }
  });
};
