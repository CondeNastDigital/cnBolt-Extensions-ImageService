define(["ImageServiceUniqueId"], function (ImageServiceUniqueId) {

    /**
     * Preview Component, shows a Thumbnail for an ListItem Component.
     * @param data {Object}
     * @param data.item {Object} Data Model of the Previewed Data
     * @param data.config {Object} System-wide config settings
     * @param data.config.events {Object} Event names that the componenet knows. ITEMTOGGLE
     * @param data.factory {Object} Collection of the needed factories
     * @param data.factory.dataModel {Object} A data-model factory needed to retrieve the possible item statuses
     */
    return function(data) {

        var that = this;
        var item = data.item;
        var preview = null;
        var container = null;
        var Events = data.config.events;
        var DataModel = data.factory.dataModel;
        var IdGenerator = new ImageServiceUniqueId('');

        /**
         * Tries to get the item path form the
         */
        that.init = function () {

            container = $('<div class="imageservice-preview"></div>');
            preview = $('<img id="'+ IdGenerator.generate(item.id) +'"/>');

            that.update(item);

            preview.on('click', function () {
                $(this).trigger(Events.ITEMTOGGLE);
            });

            container.append(preview);

        };

        /**
         * Updates the preview data
         * @param newImage
         */
        that.update = function (newImage) {

            item = newImage;

            if (item.info.source === null)
                return;

            if (item.info.source instanceof Promise && item.status != DataModel.statuses.NEW) {
                item.info.source.then(function (url) {
                    preview.attr('src', String(url).replace(/^http(s?):\/\//i,'//'));
                    item.info.source = url;
                });
            } else if (!(item.info.source instanceof Promise)) {
                preview.attr('src', String(item.info.source).replace(/^http(s?):\/\//i,'//'));
            }

        };

        /**
         * Renders the HTML
         * @returns {jQuery|HTMLElement}
         */
        that.render = function () {
            return container;
        };

        that.init();

        return that;
    }
});