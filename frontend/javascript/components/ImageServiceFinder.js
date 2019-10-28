define(function (data) {

    /**
     * Component used for image search. Send a search parameter to the Backened and shows the results.
     * @param data {Object}
     * @param data.config {Object} config object holding some system settings that the class needs
     * @param data.config.events {Object} key value Object containing the events that component fires. The Component needs only ITEMADDED as key
     * @param data.config.labels {Object} Labels that the class will use for its component, { fields.itemFind: string }
     *
     */
    return function (data) {

        var that = this;
        var Events = data.config.events;
        var Labels = data.config.labels;

        that.host = data.host;
        that.dataService = data.service;
        that.container = null;
        that.select = null;
        that.containerClass = data.containerClass;

        /**
         * The template of a single row in the suggestion list
         * @param state
         * @returns {*}
         */
        that.rowTemplate = function (state) {
            if (state.hasOwnProperty('id')) {
                var row = $('<div class="imageservice-finder-result col-xs-12"></div>');
                var image = '\''+ state.info.source+ '\'';
                var preview = $('<div class="col-xs-3 preview" style="background-image: url(' + image + ');"></div>');
                var text = $('<ul class="col-xs-9" ></ul>');

                for (var x in state.attributes) {
                    text.append($('<li><span>' + state.attributes[x] + '</span></li>'));
                }

                row.append(preview);
                row.append(text);
                return row;

            } else {
                return state.text;
            }
        };

        /**
         * The template of the current selection
         * @param repo
         * @returns {*}
         */
        that.repoTemplate = function (repo) {
            if (repo.hasOwnProperty('text'))
                return repo.text;
        };

        /**
         * Adds the Listener that notifies the list that a new items has been selected
         */
        that.addEventListeners = function () {
            that.select.select2().on('select2:select', function (event) {
                if (event.params.data) {
                    that.host.trigger(Events.ITEMADDED, {item: jQuery.extend({}, event.params.data)});
                }
            });
        };

        /**
         * Initiates external UI functionality
         */
        that.initScelect2 = function () {

            that.select.select2({
                width: '100%',
                placeholder: Labels.fields.itemFind,
                allowClear: true,
                ajax: {
                    //url: that.dataService.baseUrl + "/imagesearch",
                    //dataType: 'json',
                    delay: 500,

                    data: function (params) {
                        return {
                            q: params.term.replace(/(^\s+)|(\s+$)/igm, ''), // search term, trimmed
                            page: params.page
                        };
                    },
                    transport: function (params, success, failure) {
                        return that.dataService.imageFind(params.data)
                            .then(success)
                    },
                    processResults: function (data, params) {

                        var items = [];

                        params.page = params.page || 1;

                        for (var i in data.items)
                            items.push(data.items[i]);

                        return {
                            results: items,
                            pagination: {
                                more: false
                            }
                        };
                    },
                    cache: true
                },
                minimumInputLength: 1,
                templateResult: that.rowTemplate,
                templateSelection: that.repoTemplate
            });

        };

        /**
         * Initiates HTML
         */
        that.initHTML = function () {
            that.container = $('<div class="imageservice-finder col-xs-12 col-md-9"></div>');
            that.select = $('<select></select>');
            that.container.append(that.select);
            that.addEventListeners();
            $(that.host).append(that.container);
        };

        /**
         * Inits the object and the HTML
         */
        that.init = function () {
            that.initHTML();
            that.initScelect2();
        };

        that.init();

        return that;
    }
});