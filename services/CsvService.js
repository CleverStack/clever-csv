var fs          = require('fs')
  , lev         = require('levenshtein')
  , csv         = require('csv')
  , path        = require('path')
  , http        = require('http')
  , injector    = require('injector');

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
      }
      .bind(this));
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
      }
      .bind(this));
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
      }
      .bind(this));
    },

    readCsvFileByUrl: function(url, fileName) {
      fileName      = fileName || '';

      return new Promise(function(resolve, reject) {
        var prefix  = new Date()
          , newPath = path.join(csvConfig.pathToCsvFiles, prefix);

        newPath     = path.join(newPath, (!!fileName ? path.join(csvConfig.pathToCsvFiles, prefix, '_', fileName + '.csv') : path.join(csvConfig.pathToCsvFiles, prefix + '.csv')));

        if (fs.existsSync (csvConfig.pathToCsvFiles)) {
          var file  = fs.createWriteStream(newPath);

          http
            .get(url, function(response) {
              response
                .pipe(file)
                .on('finish', function() {
                  resolve({ path: newPath });
                });
            })
            .on('error', reject);
        } else {
          reject('Error: no such directory');
        }
      }
      .bind(this));
    },

    guessHeadersByName: function(obj) {
      return new Promise(function(resolve) {
        var headers         = obj.csv[0]
          , matrix          = []
          , requiredHeaders = _.pluck(obj.schema.fields, 'display');

        headers.forEach(function(header, i) {
          var dist = []
            , els  = [];

          requiredHeaders.forEach(function(possibleHeader, j) {
            dist.push({
              ind      : i,
              j        : j,
              lev      : lev(header, possibleHeader),
              possible : possibleHeader
            });
          });

          dist.sort(function(a, b) {
            if (a.lev < b.lev) {
              return -1;
            } else if (a.lev > b.lev) {
              return 1;
            } else {
              return 0;
            }
          });

          var value = obj.csv[1][dist[i].ind];

          for (var k in dist) {
            els.push([dist[k].j, dist[k].possible]);
          }

          els.push([-1, '--Not Match--']);

          matrix.push({value: value, possible: els});
        });

        resolve(matrix);
      }
      .bind(this));
    },

    handleExamineProcess: function(data) {
      var schema
        , filePath;

      return new Promise(function(resolve, reject) {
        this
        .readCsvSchemaFile(data.type)
        .then(this.proxy(function(res) {
          schema = res.schema;
          return this.readCsvFileByUrl(data.url, data.filename);
        }))
        .then(this.proxy(function(res) {
          filePath = res.path;
          return this.uploadFromFile(path, data.options);
        }))
        .then(this.proxy(function(csv) {
          return this.guessHeadersByName({csv: csv, schema: schema});
        }))
        .then(function(column) {
          resolve({
            columns    : column,
            tmpCsvPath : filePath
          });
        })
        .catch(reject);
      }
      .bind(this));
    },

    reorganizeDataByColumns: function(data) {
      var result = {
        data    : [],
        columns : []
      };

      return new Promise(function(resolve) {
        data.columns.forEach(function(ind) {
          ind = parseInt(ind, 10);
          if (ind >= 0) {
            var field = data.schema.fields[ind];

            result.columns.push ({
              type          : field.type,
              title         : field.name,
              titleReadable : field.display
            });
          }
        });

        data.csv.forEach(function(row, rowNum) {
          var el = {};

          if (rowNum !== 0) {
            data.columns.forEach(function(ind, i) {
              ind = parseInt(ind, 10);
              if (ind >= 0) {
                el[data.schema.fields[i].name] = data.csv[rowNum][ind];
              }
            });

            result.data.push(el);
          }
        });

        resolve(result);
      }
      .bind(this));
    },

    handleSubmitDraftProcess: function(data) {
      var schema;

      return new Promise(function(resolve, reject) {
        this
        .readCsvSchemaFile(data.type)
        .then(this.proxy(function(res) {
          schema = res.schema;
          return this.uploadFromFile(data.path, data.options);
        }))
        .then (this.proxy(function(csv) {
          return this.reorganizeDataByColumns({
            csv     : csv,
            schema  : schema,
            columns : data.columns
          });
        }))
        .then(resolve)
        .catch(reject);
      }
      .bind(this));
    },

    saveData: function (schema, data) {
      return new Promise(function(resolve, reject) {
        injector._resolve(schema.service, function(err, name, _service) {
          if (!!err) {
            resolve({
              message        : err.toString(),
              statusCode     : 500
            });
          } else {
            async.eachSeries(
              data,
              function eachRow(row, next) {
                _service[schema.method]({row: row}).then(function () {
                  next();
                }, next);
              },
              function (err) {
                if (!!err) {
                  resolve({
                    message    : err.toString(),
                    statusCode : 500
                  });
                } else {
                  resolve({
                    message    : 'data has been saved',
                    statusCode : 200
                  });
                }
              }
            );
          }
        });
      }
      .bind(this));
    },

    handleSubmitFinalProcess: function (data) {
      var schema;

      return new Promise(function(resolve, reject) {
        this
        .readCsvSchemaFile(data.type)
        .then(this.proxy(function(res) {
          schema = res.schema;
          return this.uploadFromFile(data.path, data.options);
        }))
        .then(this.proxy(function(csv) {
          return this.reorganizeDataByColumns({
            csv     : csv,
            schema  : schema,
            columns : data.columns
          });
        }))
        .then(this.proxy(function(prData) {
          return this.saveData(schema, prData.data);
        }))
        .then(resolve)
        .fail(reject);
      }
      .bind(this));
    }
  });
};
