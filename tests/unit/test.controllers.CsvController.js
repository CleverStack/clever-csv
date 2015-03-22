var expect   = require('chai').expect
  , config   = require('config')['clever-csv']
  , fs       = require('fs')
  , injector = require('injector')
  , Controller
  , Service;

describe('controllers.CsvController', function() {
  var ctrl;

  this.timeout(25000);

  function fakeResponse(cb) {
    return {
      json: function(code, message) {
        setTimeout(function() {
          cb(code, JSON.parse(JSON.stringify(message)));
        }, 10);
      },

      send: function(code, message) {
        setTimeout(function() {
          cb(code, message);
        }, 10);
      }
    };
  }

  function fakeRequest(req) {
    req.method  = req.method || 'GET';
    req.url     = req.url || ('/fakeAction');
    req.query   = req.query || {};
    req.body    = req.body || {};
    req.params  = req.params || {};

    return req;
  }

  before(function(done) {
    var CsvController = injector.getInstance('CsvController')
      , CsvService    = injector.getInstance('CsvService');

    var req = {
      params: { action: 'fakeAction'},
      method: 'GET',
      query: {}
    };

    var res = {
      json: function() {}
    };

    var next = function() {};

    ctrl = new CsvController(req, res, next);

    Service    = CsvService;
    Controller = CsvController;

    done();
  });

  afterEach(function(done) {
    ctrl = null;
    done();
  });

  describe('.typesAction()', function() {
    it('should be able to get all possible types', function(done) {
      var req = fakeRequest({
        url: '/csvs/types',
        params: {
          action: 'types'
        }
      });

      var res = fakeResponse(function(status, result) {
        expect(status).to.equal(200);

        expect(result).to.be.an('array').and.have.length.above(0);

        var type = result[0];

        expect(type).to.be.a('object').and.be.ok;
        expect(type).to.have.property('name').and.be.ok;
        expect(type).to.have.property('description').and.be.ok;
        expect(type).to.have.property('service').and.be.ok;
        expect(type).to.have.property('method').and.be.ok;
        expect(type).to.have.property('fields').and.be.an('array');

        done();
      });

      ctrl = Controller.callback('newInstance')(req, res);
    });

    it('should be able to get empty array if directory do not have necessary files', function(done) {
      var oldPath = config.pathToCsvSchemaFiles;

      config.pathToCsvSchemaFiles = './modules/';

      var typesPath = config.pathToCsvSchemaFiles;

      expect(oldPath).to.not.equal(typesPath);

      var req = fakeRequest({
        url: '/csvs/types',
        params: {
          action: 'types'
        }
      });

      var res = fakeResponse(function(status, result) {
        expect(status).to.equal(200);

        expect(result).to.be.an('array').and.be.empty;

        config.pathToCsvSchemaFiles = oldPath;

        done();
      });

      ctrl = Controller.callback('newInstance')(req, res);
    });

    it('should be able get error if directory for type file do not exist', function(done) {

      var oldPath = config.pathToCsvSchemaFiles;

      config.pathToCsvSchemaFiles = oldPath + 'asasasasa/';

      var typesPath = config.pathToCsvSchemaFiles;

      expect(oldPath).to.not.equal(typesPath);

      var req = fakeRequest({
        url: '/csvs/types',
        params: {
          action: 'types'
        }
      });

      var res = fakeResponse(function(status, result) {
        expect(status).to.equal(403);

        expect(result).to.be.an('string').and.equal('no such directory');

        config.pathToCsvSchemaFiles = oldPath;

        done();
      });

      ctrl = Controller.callback('newInstance')(req, res);
    });
  });

  describe('.examineAction()', function() {

    it.skip('should be able to return preparing data', function(done) {
        //for run this test you need have have a valid link

        ctrl.send = function(result, status) {

          expect(status).to.equal(200);

          expect(result).to.be.an('object').and.be.ok;
          expect(result).to.have.property('columns').and.be.ok;
          expect(result).to.have.property('tmpCsvPath').and.be.ok;

          expect(result.tmpCsvPath).to.contain(config.pathToCsvFiles);
          expect(result.tmpCsvPath).to.contain('myNewCsvFile');
          expect(result.tmpCsvPath).to.contain('.csv');

          expect(fs.existsSync(result.tmpCsvPath)).to.be.true;

          expect(result.columns).to.be.an('array').and.have.length(18);
          expect(result.columns[0]).to.be.an('object').and.be.ok;

          expect(result.columns[0]).to.have.property('value').and.be.ok;
          expect(result.columns[0]).to.have.property('possible').and.be.an('array');

          done();
        };

        ctrl.req.body = {
          type: 'exampleEmployee',
          url: config.urlToTestCsvFile,
          filename: 'myNewCsvFile',
          options: {}
        };

        ctrl.examineAction();
      });
    it('should be able get error if insufficient url', function(done) {
      var req = fakeRequest({
        url    : '/csvs/examine',
        method : 'POST',
        body   : {
          type     : 'exampleEmployee',
          options  : {},
          filename : 'myNewCsvFile'
        },
        params : {
          action: 'examine'
        }
      });

      var res = fakeResponse(function(status, result) {
        expect(status).to.equal(400);

        expect(result).to.be.an('object').and.have.property('message').and.equal('Invalid Url.');

        done();
      });

      ctrl = Controller.callback('newInstance')(req, res);
    });

    it('should be able get error if insufficient type', function(done) {
      var req = fakeRequest({
        url    : '/csvs/examine',
        method : 'POST',
        body   : {
          url      : config.urlToTestCsvFile,
          options  : {},
          filename : 'myNewCsvFile'
        },
        params : {
          action: 'examine'
        }
      });

      var res = fakeResponse(function(status, result) {
        expect(status).to.equal(400);

        expect(result).to.be.an('object').and.have.property('message').and.equal('Invalid Type.');

        done();
      });

      ctrl = Controller.callback('newInstance')(req, res);
    });

    it('should be able get error if directory for save csv file do not exist', function(done) {
      var oldPath = config.pathToCsvFiles;

      config.pathToCsvFiles = oldPath + 'asasasasa/';

      var req = fakeRequest({
        url    : '/csvs/examine',
        method : 'POST',
        body   : {
          url      : config.urlToTestCsvFile,
          options  : {},
          filename : 'myNewCsvFile',
          type     : 'exampleEmployee'
        },
        params : {
          action: 'examine'
        }
      });

      var res = fakeResponse(function(status, result) {
        expect(status).to.equal(500);

        expect(result).to.be.an('object').and.be.ok;
        expect(result).to.have.property('message').and.be.ok;

        config.pathToCsvFiles = oldPath;

        done();
      });

      ctrl = Controller.callback('newInstance')(req, res);
    });

    it('should be able get error if schema file do not exist', function(done) {
      var req = fakeRequest({
        url    : '/csvs/examine',
        method : 'POST',
        body   : {
          url      : config.urlToTestCsvFile,
          options  : {},
          filename : 'myNewCsvFile',
          type     : 'exampleEmployee_'
        },
        params : {
          action: 'examine'
        }
      });

      var res = fakeResponse(function(status, result) {
        expect(status).to.equal(403);
        expect(result).to.be.an('string').and.be.eql('Error: no such file');

        done();
      });

      ctrl = Controller.callback('newInstance')(req, res);
    });
  });

  describe('.submitDraftAction()', function() {

    it.skip('should be able to get reorganized data', function(done) {

      ctrl.send = function(result, status) {

        expect(status).to.equal(200);

        expect(result).to.be.an('object').and.be.ok;
        expect(result).to.have.property('columns').and.be.ok;
        expect(result).to.have.property('data').and.be.ok;

        var columns = result.columns;

        expect(columns).to.be.an('array').and.have.length(15);
        expect(columns[0]).to.be.an('object').and.be.ok;
        expect(columns[0]).to.have.property('titleReadable').and.be.ok;
        expect(columns[0]).to.have.property('title').and.be.ok;
        expect(columns[0]).to.have.property('type').and.be.ok;

        var data = result.data;

        expect(data).to.be.an('array').and.have.length.above(0);
        expect(data[0]).to.be.an('object').and.be.ok;
        expect(data[0]).to.have.property('firstName').and.be.ok;
        expect(data[0]).to.have.property('lastName').and.be.ok;
        expect(data[0]).to.have.property('fullName').and.be.ok;
        expect(data[0]).to.have.property('cellPhone').and.be.ok;
        expect(data[0]).to.have.property('notes').and.be.ok;

        expect(data[0]).to.not.have.property('Name');
        expect(data[0]).to.not.have.property('Skype ID');
        expect(data[0]).to.not.have.property('secondaryLanguage');

        done();
      };

      ctrl.req.body = {
        columns: [0, 1, 2, -1, 4, 5, 6, 7, 8, 9, -1, 11, 12, 13, 14, 15, 16, -1],
        tmpCsvPath: [config.pathToTestCsvFiles, 'examplePersonal.csv'].join(''),
        type: 'exampleEmployee'
      };

      ctrl.submitDraftAction();
    });

    it.skip('should be able get error if insufficient columns', function(done) {

      ctrl.send = function(result, status) {

        expect(status).to.equal(400);

        expect(result).to.be.an('string').and.equal('Insufficient data');

        done();
      };

      ctrl.req.body = {
        tmpCsvPath: [config.pathToTestCsvFiles, 'examplePersonal.csv'].join(''),
        type: 'exampleEmployee'
      };

      ctrl.submitDraftAction();
    });

    it.skip('should be able get error if insufficient tmpCsvPath', function(done) {

      ctrl.send = function(result, status) {

        expect(status).to.equal(400);

        expect(result).to.be.an('string').and.equal('Insufficient data');

        done();
      };

      ctrl.req.body = {
        columns: [0, 1, 2, -1, 4, 5, 6, 7, 8, 9, -1, 11, 12, 13, 14, 15, 16, -1],
        type: 'exampleEmployee'
      };

      ctrl.submitDraftAction();
    });

    it.skip('should be able get error if insufficient type', function(done) {

      ctrl.send = function(result, status) {

        expect(status).to.equal(400);

        expect(result).to.be.an('string').and.equal('Insufficient data');

        done();
      };

      ctrl.req.body = {
        columns: [0, 1, 2, -1, 4, 5, 6, 7, 8, 9, -1, 11, 12, 13, 14, 15, 16, -1],
        tmpCsvPath: [config.pathToTestCsvFiles, 'examplePersonal.csv'].join('')
      };

      ctrl.submitDraftAction();
    });

    it.skip('should be able get error if directory for read csv file do not exist', function(done) {

      var oldPath = config.pathToTestCsvFiles;

      config.pathToTestCsvFiles = oldPath + 'asasasasa/';

      ctrl.send = function(result, status) {

        expect(status).to.equal(500);

        expect(result).to.be.an('object').and.be.ok;
        expect(result).to.have.property('error').and.be.ok;

        config.pathToTestCsvFiles = oldPath;

        done();
      };

      ctrl.req.body = {
        columns: [0, 1, 2, -1, 4, 5, 6, 7, 8, 9, -1, 11, 12, 13, 14, 15, 16, -1],
        tmpCsvPath: [config.pathToTestCsvFiles, 'examplePersonal.csv'].join(''),
        type: 'exampleEmployee'
      };

      ctrl.submitDraftAction();
    });

    it.skip('should be able get error if schema file do not exist', function(done) {

      ctrl.send = function(result, status) {

        expect(status).to.equal(500);

        expect(result).to.be.an('object').and.be.ok;
        expect(result).to.have.property('error').and.be.ok;

        done();
      };

      ctrl.req.body = {
        columns: [0, 1, 2, -1, 4, 5, 6, 7, 8, 9, -1, 11, 12, 13, 14, 15, 16, -1],
        tmpCsvPath: [config.pathToTestCsvFiles, 'examplePersonal.csv'].join(''),
        type: 'exampleEmployee_'
      };

      ctrl.submitDraftAction();
    });
  });

  describe('.submitFinalAction()', function() {

    it.skip('should be able get error if insufficient columns', function(done) {

      ctrl.send = function(result, status) {

        expect(status).to.equal(400);

        expect(result).to.be.an('string').and.equal('Insufficient data');

        done();
      };

      ctrl.req.body = {
        tmpCsvPath: [config.pathToTestCsvFiles, 'examplePersonal.csv'].join(''),
        type: 'exampleEmployee'
      };

      ctrl.submitFinalAction();
    });

    it.skip('should be able get error if insufficient tmpCsvPath', function(done) {

      ctrl.send = function(result, status) {

        expect(status).to.equal(400);

        expect(result).to.be.an('string').and.equal('Insufficient data');

        done();
      };

      ctrl.req.body = {
        columns: [0, 1, 2, -1, 4, 5, 6, 7, 8, 9, -1, 11, 12, 13, 14, 15, 16, -1],
        type: 'exampleEmployee'
      };

      ctrl.submitFinalAction();
    });

    it.skip('should be able get error if insufficient type', function(done) {

      ctrl.send = function(result, status) {

        expect(status).to.equal(400);

        expect(result).to.be.an('string').and.equal('Insufficient data');

        done();
      };

      ctrl.req.body = {
        columns: [0, 1, 2, -1, 4, 5, 6, 7, 8, 9, -1, 11, 12, 13, 14, 15, 16, -1],
        tmpCsvPath: [config.pathToTestCsvFiles, 'examplePersonal.csv'].join('')
      };

      ctrl.submitFinalAction();
    });

    it.skip('should be able get error if directory for read csv file do not exist', function(done) {

      var oldPath = config.pathToTestCsvFiles;

      config.pathToTestCsvFiles = oldPath + 'asasasasa/';

      ctrl.send = function(result, status) {

        expect(status).to.equal(500);

        expect(result).to.be.an('object').and.be.ok;
        expect(result).to.have.property('error').and.be.ok;

        config.pathToTestCsvFiles = oldPath;

        done();
      };

      ctrl.req.body = {
        columns: [0, 1, 2, -1, 4, 5, 6, 7, 8, 9, -1, 11, 12, 13, 14, 15, 16, -1],
        tmpCsvPath: [config.pathToTestCsvFiles, 'examplePersonal.csv'].join(''),
        type: 'exampleEmployee'
      };

      ctrl.submitFinalAction();
    });

    it.skip('should be able get error if servece do not exist', function(done) {

      ctrl.send = function(result, status) {

        expect(status).to.equal(500);

        expect(result).to.be.an('object').and.be.ok;
        expect(result).to.have.property('error').and.be.ok;

        done();
      };

      ctrl.req.body = {
        columns: [0, 1, 2, -1, 4, 5, 6, 7, 8, 9, -1, 11, 12, 13, 14, 15, 16, -1],
        tmpCsvPath: [config.pathToTestCsvFiles, 'examplePersonal.csv'].join(''),
        type: 'exampleEmployee'
      };

      ctrl.submitFinalAction();
    });

  });

});
