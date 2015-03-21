module.exports = function(Controller, Promise, Exceptions, CsvService) {
  return Controller.extend({ service: CsvService },
  {
    typesAction: function() {
      return CsvService.getAllPossibleTypes();
    },

    examineAction: function () {
      var data = {
        url      : this.req.body.url,
        type     : this.req.body.type,
        options  : this.req.body.options  || {},
        filename : this.req.body.filename || ''
      };

      if (!data.type || !data.url) {
        return Promise.reject(new Exceptions.InvalidData('Invalid ' + (!data.type ? 'Type' : 'Url') + '.'));
      }

      return CsvService.handleExamineProcess(data);
    },

    submitDraftAction: function() {
      var data = {
        type     : this.req.body.type,
        path     : this.req.body.tmpCsvPath,
        options  : this.req.body.options || {},
        columns  : this.req.body.columns
      };

      if (!data.columns || !data.path || !data.type) {
        return Promise.reject(new Exceptions.InvalidData('Invalid ' + (!data.type ? 'Type' : (!data.path ? 'Url' : 'Path')) + '.'));
      }

      return CsvService.handleSubmitDraftProcess(data);
    },

    submitFinalAction: function () {
      var data = {
        type     : this.req.body.type,
        path     : this.req.body.tmpCsvPath,
        options  : this.req.body.options || {},
        columns  : this.req.body.columns
      };

      if (!data.columns || !data.path || !data.type) {
        return Promise.reject(new Exceptions.InvalidData('Invalid ' + (!data.type ? 'Type' : (!data.path ? 'Url' : 'Path')) + '.'));
      }

      return CsvService.handleSubmitFinalProcess(data);
    }
  });
};
