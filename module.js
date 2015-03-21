var Module     = require('classes').Module;

var CsvModule  = Module.extend({
  configureApp: function(app, express) {
    app.use(express.static(this.config.pathToCsvFiles));
  }
});

module.exports = CsvModule;
