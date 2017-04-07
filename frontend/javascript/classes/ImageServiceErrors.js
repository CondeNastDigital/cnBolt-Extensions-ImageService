/**
 * Image Service Error messages
 */
define(function(){
    return function(options) {
        var that = this;
        var errors = {
            fileexists:  'The file already exists. Please add it via the search field',
            filesize:    'The uploaded file is too big. Please choose a smaller one',
            nofile:      'No file has been fount, for the new image',
            fileext:     'The files extension is unknown',
            status:      'Invalid image status',
            unknown:     'Something went wrong. Try again and if the problem persits call an administrator',
            fileinvalid: 'File is invalid. Either too big or the of an unsuported type',
            accessdenied: 'You are not logged in!'
        };

        if(options instanceof Object && options.hasOwnProperty('errors'))
            errors = Object.assign(errors, options.errors);

        /**
         * Returns a meaningfull error
         * @param error
         * @returns {*}
         */
        that.create = function(error) {
            return errors.hasOwnProperty(error)? errors[error]: errors['unknown'];
        }

    }

});
