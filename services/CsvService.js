var fs          = require('fs')
  , lev         = require('levenshtein')
  , csv         = require('csv')
  , path        = require('path')
  , http        = require('http');

module.exports  = function(Service, Promise, async, config, _) {
  var csvConfig = config['clever-csv'];

  return Service.extend({

    uploadFromFile: function(filePath, options) {
      options   = options || {};

      return new Promise(function(resolve, reject) {
        if (fs.existsSync(filePath)) {
          csv()
            .from.path(filePath, options)
            .to.array(resolve)
            .on('error', reject);
        } else {
          reject('Error: no such file');
        }
      });
    },

    getAllPossibleTypes: function() {
      var typesPath = csvConfig.pathToCsvSchemaFiles
        , result    = [];

      return new Promise(function(resolve, reject) {
        if (fs.existsSync(typesPath)) {
          fs.readdir(typesPath, function(err, files) {

            if (err !== undefined && err !== null) {
              reject(err);
            } else {
              files.forEach(function(typeFile) {
                if (path.extname(typeFile) === '.json') {
                  var file = [ typesPath, typeFile ].join('')
                    , data = fs.readFileSync (file, 'utf8');

                  result.push (JSON.parse (data));
                }
              });

              resolve(result);
            }
          });
        } else {
          reject({ statusCode: 403, message: 'no such directory' });
        }
      });
    },

    readCsvSchemaFile: function(type) {
      var file = path.join(csvConfig.pathToCsvSchemaFiles, type + '.json');

      return new Promise(function(resolve, reject) {
        if (fs.existsSync(file)) {
          fs.readFile(file, 'utf8', function (err, data) {
            if (err !== undefined && err !== null) {
              reject(err);
            } else {
              resolve({
                schema  : JSON.parse(data)
              });
            }
          });
        } else {
          reject({ statusCode: 403, message: 'Error: no such file' });
        }
      });
    },

    readCsvFileByUrl: function(url, fileName) {
      fileName      = fileName || '';

      return new Promise(function(resolve, reject) {
        var prefix  = new Date()
          , newPath = !!fileName ? path.join(csvConfig.pathToCsvFiles, prefix, '_', fileName + '.csv') : path.join(csvConfig.pathToCsvFiles, prefix + '.csv');

        if (fs.existsSync (csvConfig.pathToCsvFiles)) {
          var file  = fs.createWriteStream (newPath);

          http
          .get (url, function (response) {
            var r   = response.pipe (file);
            r.on ('finish', function () {
              deferred.resolve ({ path: newPath });
            });
          }).on ('error', function (err) {
            deferred.reject (err);
          });
        } else {
          deferred.reject ('Error: no such directory');
        }
      });
    },

    guessHeadersByName: function (obj) {
      var deferred = Q.defer ()
      , headers = obj.csv[0]
      , requiredHeaders = _.pluck (obj.schema.fields, 'display')
      , mapping = []
      , matrix = [];

      headers.forEach (function (header, i) {
        var dist = []
        , els = [];

        requiredHeaders.forEach (function(possibleHeader, j) {
          dist.push ({
            ind: i,
            j: j,
            lev: lev (header, possibleHeader),
            possible: possibleHeader
          });

        });

        dist.sort (function (a, b) {
          if (a.lev < b.lev) return -1;
          if (a.lev > b.lev) return 1;
          return 0;
        });

        var value = obj.csv[ 1 ][ dist[ i ].ind ];

        for (var k in dist) {
          el = dist[ k ].possible;
          els.push ([ dist[ k ].j, el ]);
        }

        els.push([ -1, "--Not Match--" ]);

        matrix.push ({ value: value, possible: els });
      });

      deferred.resolve (matrix);

      return deferred.promise;
    },

    handleExamineProcess: function (data) {
      var deferred = Q.defer ()
      , service = this
      , result = {}
      , schema, path;

      service
      .readCsvSchemaFile (data.type)
      .then (function(res) {
        schema = res.schema;
        return service.readCsvFileByUrl (data.url, data.filename)
      })
      .then (function(res) {
        path = res.path;
        return service.uploadFromFile (path, data.options)
      })
      .then (function(csv) {
        return service.guessHeadersByName ({ csv: csv, schema: schema })
      })
      .then (function(column) {
        deferred.resolve ({columns: column, tmpCsvPath: path });
      })
      .fail (deferred.reject);

      return deferred.promise;
    },

    reorganizeDataByColumns: function (data) {
      var deferred = Q.defer ()
      , result = {
        columns: [],
        data: []
      };

            //columns
            data.columns
            .forEach(function (ind) {

              ind = parseInt (ind);

              if (ind >= 0) {
                var field = data.schema.fields[ ind ];

                result.columns.push ({
                  titleReadable: field.display,
                  title: field.name,
                  type: field.type
                });
              }
            });

            //data from csv
            data.csv
            .forEach(function (row, rowNum) {
              if (rowNum !== 0) {

                var el = {};

                data.columns
                .forEach(function (ind, i) {

                  ind = parseInt (ind);

                  if (ind >= 0) {
                    var field = data.schema.fields[ i ].name;
                    el[ field ] = data.csv[ rowNum ][ ind ];
                  }
                });

                result.data.push (el);
              }
            });

            deferred.resolve (result);

            return deferred.promise;
          },

          handleSubmitDraftProcess: function (data) {
            var deferred = Q.defer ()
            , service = this
            , schema;

            service
            .readCsvSchemaFile (data.type)
            .then (function(res) {
              schema = res.schema;
              return service.uploadFromFile (data.path, data.options)
            })
            .then (function(csv) {
              return service.reorganizeDataByColumns ({ csv: csv, schema: schema, columns: data.columns })
            })
            .then (function(result) {
              deferred.resolve (result);
            })
            .fail (deferred.reject);

            return deferred.promise;
          },

          saveData: function (schema, data) {
            var deferred = Q.defer ()
            , service = schema.service
            , method = schema.method
            , result = {};

            injector._resolve (service, function (err, name, _service) {
              if (!!err) {
                deferred.resolve ({ statuscode: 500, message: err.toString() });
              } else {
                async.eachSeries (data, function (row, next) {
                  _service[ method ] ({ row: row }).then (function () {
                    next ();
                  }, next);
                }, function (err) {
                  if (!!err) {
                    deferred.resolve ({ statuscode: 500, message: err.toString() });
                  } else {
                    deferred.resolve ({ statuscode: 200, message: 'data has been saved' });
                  }
                });
              }

            });

            return deferred.promise;
          },

          handleSubmitFinalProcess: function (data) {
            var deferred = Q.defer ()
            , service = this
            , schema;

            service
            .readCsvSchemaFile (data.type)
            .then (function(res) {
              schema = res.schema;
              return service.uploadFromFile (data.path, data.options)
            })
            .then (function(csv) {
              return service.reorganizeDataByColumns ({ csv: csv, schema: schema, columns: data.columns })
            })
            .then (function(prData) {
              return service.saveData (schema, prData.data)
            })
            .then (function(result) {
              deferred.resolve (result);
            })
            .fail (deferred.reject);

            return deferred.promise;
          }

        });

CsvService.instance = new CsvService ();

return CsvService.instance;
};
