/**
 * Created by ralev on 05.04.17.
 */

define(function () {

    return function(data) {

        var that = this;

        /**
         * Error Factory
         * TODO: Turn in to a real factory
         */
        var Errors = data.factory.errors;

        /**
         * Used as a cache. Right now its only used to get the urls of the current saved items
         * @type {*|{}}
         */
        that.defaults = data.defaults || {};

        /**
         * Where the backened services reside
         */
        that.baseUrl = data.basUrl;

        /**
         * Save a list of items. the new items expact a corresponding memebr of the files array.
         * @param data {{items: array, files: array, callback: function, async: bool}}
         */
        that.imageSave = function (data) {

            var items = data.items,
                files = data.files,
                callback = data.callback,
                warningCallback = data.warning,
                errorCallback = data.error,
                async = data.async || true,
                formData = new FormData(),
                slugifiedName = '';

            // Format data to fit the backend
            if (files instanceof Object) {
                for (var i in files) {

                    if (items[i].status == 'new' && !files[i]) {
                        errorCallback('nofile');
                        console.error('[ImageServiceConnector::imageSave] One of the new items does not have a valid file attached');
                        return;
                    }

                    if (items[i].status == 'new') {
                        slugifiedName = that.slugify(files[i].name);
                        items[i].id = slugifiedName;
                        formData.append(slugifiedName, files[i], files[i].name);
                    }
                }
            }

            // adds the files
            formData.append('items', JSON.stringify(items));

            // sends the ajax request
            return $.ajax({

                type: 'POST',
                url: that.baseUrl + '/imageprocess',
                data: formData,
                dataType: 'json',
                contentType: false,
                processData: false,
                async: async,

                success: function (response) {

                    if (response.success === true && response.messages && response.messages.length)
                        warningCallback(response.messages);

                    if (response.success === false && response.messages && response.messages.length)
                        return errorCallback(Errors.create(response.messages[0].code));

                    if (response.success === true && typeof(callback) === 'function')
                        return callback(response.items);

                },

                error: function (jqXHR, textStatus, errorThrown) {
                    return errorCallback(errorThrown);
                }

            });
        };

        // TODO: Remove as its not needed. The url comes back on item create
        that.getImageUrl = function (imageId, service) {

            var deferred = {};
            deferred.promise = new Promise(function (resolve, reject) {
                deferred.resolve = resolve;
                deferred.reject = reject;
            });

            if (that.defaults.hasOwnProperty('urls') && that.defaults.urls.hasOwnProperty(imageId)) {
                deferred.resolve(that.defaults.urls[imageId]);
            } else {

                $.ajax({
                    url: that.baseUrl + '/imageurl',
                    data: {
                        imageid: imageId,
                        width: null,
                        height: null,
                        service: service
                    },
                    success: function (data) {
                        deferred.resolve(data.url);
                    }
                });

            }

            return deferred.promise;
        };

        /**
         * Cleans data for the backend. Its only needed to clean the File name
         * @param str
         * @returns {*}
         */
        that.slugify = function (str) {
            return str.replace(/[^a-z0-9\_\-]+/igm, '');
        };

        return that;
    }
});