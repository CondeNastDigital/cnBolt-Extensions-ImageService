define(function(){
    /**
     * Error Factory Class
     * Translates the system errors in to human messages
     * Mainly used by the Backend Service
     * @param options {Object}
     * @param options.errors {Object} A set of error: message key value pairs
     */
    return function(options) {

        var that = this;

        /**
         * Default errors
         * @type {{fileexists: string, filesize: string, nofile: string, fileext: string, status: string, unknown: string, fileinvalid: string, accessdenied: string}}
         */
        var errors = {
            fileexists:  'The uploaded file already exists. The initially uploaded file has been added to the list',
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
         * Returns a meaningful error
         * @param error System known error code
         * @returns {String} A human readable error message
         */
        that.create = function(error) {
            return errors.hasOwnProperty(error)? errors[error]: errors['unknown'];
        }

    }

});
