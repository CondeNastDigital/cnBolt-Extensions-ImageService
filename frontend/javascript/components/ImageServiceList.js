define(function () {

    /**
     * A Component that renders a list.
     *
     * @param data {object}
     * @param data.config {object} Configuration object that brings system-wide settings to the component
     * @param data.config.events {object} Key-Value pairs of events that the Component uses.
     *     - LISTSAVED, list saved
     *     - ITEMADDED, item removed
     *     - ITEMDELETED, item deleted
     *     - ITEMEXCLUDED, item excluded form the list without deleting it form the service
     *     - MESSAGEWARNING, shows a warning
     *
     * @param data.factory {object} object holding the factories that the component needs.
     * @param data.factory.listItem {object} the factory for creating a new ImageServiceListItems that render a new list row.
     * @param data.factory.model {object} Factory for Creating a Data-Model for the ListItem
     * @param data.hostElement {object} jQuery object where the list will add its HTML code and where the events will be fires/listened to
     *
     */
    return function(data) {

        var that = this;

        // Events
        var Events = data.config.events;

        // ListItem Factory
        var ListItem = data.factory.listItem;

        // Image Data Model
        var Model = data.factory.model;

        /**
         * Indicates a form change
         * @type {boolean}
         */
        that.dirty = false;

        /**
         *
         * @type {null}
         */
        that.dropBefore = null;

        /**
         * jQuery element that hosts the current instance of the service
         * @type {jQuery|HTMLElement}
         */
        that.host = data.hostElement;

        /**
         * Generated Item entities
         * @type {Array}
         */
        that.imageEntities = [];

        /**
         * jQuery object - the list html instance
         * @type {null}
         */
        that.container = null;

        /**
         * The maximal number of items in the list null == without a limit
         * @type {int|null}
         */
        that.maxItems = data.maxItems || null;

        /**
         * Constructor
         */
        that.init = function () {
            that.reset(data.items.items);
            that.addListeners();
        };

        /**
         * Resets the content of the list with new content
         * @param newItems
         */
         that.reset = function (newItems) {

            newItems = newItems || [];

            if (that.container != null)
                that.container.remove();

            that.container = $('<div class="imageservice-list"></div>');
            $(that.host).append(that.container);

            that.imageEntities = [];

            // Add the data to the internal array
            for (var i = 0; i < newItems.length; i++) {
                that.addItem(newItems[i]);
            }

            // Makes the list sortable
            /*if ($.fn.sortable) {
                that.container.sortable({
                    update: that.onListSorted,
                    cancel: '.no-drag'
                });
            }*/

            that.dirty = false;
        };

        /**
         *
          * @param item
         */
        that.addDragDropToItem = function(item, index) {

            $(item).children().each((el) => {
                $(this).find('*').on('dragenter dragover dragleave', (e)=>{e.stopPropagation(); e.preventDefault()})
            });

            $(item).on('dragover', function(event){

                let handle = () => {
                    that.dropBefore = $(item);
                }

                if(!($(item)[0].dropHint || false)) {
                    let target = $('<div class="drop-target"> ^^^ Place on Top ^^^ </div>');
                    $(this).prepend(target);
                    $(item)[0].dropHint = target;
                    target.on('dragenter', handle );
                    target.on('dragleave dragend', () => {
                        target.remove();
                        $(item)[0].dropHint = null;
                    });
                }
                handle();
            });

            $(item).on('dragend drop', function(event){
                $(item).find('.drop-target').remove();
                $(item)[0].dropHint = null;
            });

        }

        /**
         * Registers the listeners
         */
        that.addListeners = function () {

            $(that.host).on('drop', function (event) {

                event.stopPropagation();

                window.cnImageServiceDragState = window.cnImageServiceDragState || [];

                let item = null;
                while(item = window.cnImageServiceDragState.pop()) {

                    let position = that.container.children().index(that.dropBefore);
                    let eventData = {
                        item: item.originalItem.getData(),
                        file: item.originalItem.getFile(),
                        position: position > -1 ? position : null
                    };

                    item.originalItem.onItemDelete(false);
                    $(that.host).trigger(Events.ITEMADDED, eventData);

                    that.dirty = true;
                    $(that.host).removeClass('focused');
                }

            });

            $(that.host).on('dragover',function(event){
                $(that.host).addClass('focused');
                event.preventDefault();
            });

            $(that.host).on('dragleave',function(event){
                $(that.host).removeClass('focused');
                event.preventDefault();
            });

            $(that.host).on('dragenter',function(event){
                event.preventDefault();
            });

            $(that.host).on('dragend', function(event){
                $(that.host).removeClass('focused');
                $(that.host).find('.drag-target').remove();
            });

            // On list saved
            $(that.host).on(Events.LISTSAVED, function (event, newItems) {
                that.reset(newItems.items);
            });

            // On element change
            $(that.host).on('change', function (event) {
                that.dirty = true;
            });

            // On new item added
            $(that.host).on(Events.ITEMADDED, function (event, data) {
                if (data.hasOwnProperty('item')) {

                    var newItem = that.addItem(
                        data.item,
                        data.file || null,
                        data.hasOwnProperty('position') ? data.position : null
                    );

                    if (!newItem)
                        return;

                    var offsets = newItem.getOffsets();

                    that.container.animate({scrollTop: offsets.top}, 500);
                    that.dirty = true;
                }
            });

            $(that.host).on(Events.ITEMDELETED, function (event, item) {
                that.dirty = true;
                if (item.getData().status == Model.statuses.EXCLUDE)
                    that.removeItem(item);
            });

            $(that.host).on(Events.ITEMEXCLUDED, function (event, item) {
                that.dirty = true;
                that.removeItem(item);
            });

        };

        /**
         * Return the current data of the list
         * @returns {{items: Array, files: Array}}
         */
        that.getData = function () {

            var items = [];
            var files = [];

            that.imageEntities.forEach(function (entity) {
                items.push(entity.getData());
                files.push(entity.getFile() || null);
            });

            return {
                items: items,
                files: files
            };
        };

        /**
         * Removes an element form the list
         * @param item
         */
        that.removeItem = function (item) {
            var itemIndex = that.imageEntities.indexOf(item);
            if (itemIndex >= 0) {
                that.imageEntities.splice(itemIndex, 1);
            }
        };


        /**
         * Adds a single item to the list
         * @param imageData
         * @param fileData
         * @returns {ImageServiceListItem}
         */
        that.addItem = function (imageData, fileData, position) {

            if (imageData.status == Model.statuses.DELETED) {
                that.container.trigger(Events.MESSAGEWARNING, 'Added image has a delete status');
                return;
            }

            // Limits the number of files in the list
            if (that.maxItems == 1 && that.getListLength() >= that.maxItems) {
                that.imageEntities[0].onItemDelete(false);
            } else if (that.maxItems && that.getListLength() >= that.maxItems) {
                that.container.trigger(Events.MESSAGEWARNING, 'Maximal number of list items reached.');
                return;
            }

            var newEntity = ListItem.create({
                item: jQuery.extend({}, imageData),
                file: fileData,
                prefix: that.host.attr('id') + '_' + that.imageEntities.length
            });

            position = typeof position !== 'undefined' ? position : that.imageEntities.length;

            that.imageEntities.splice(position, 0, newEntity );
            let target = that.container.children()[position] || null;
            let entityRender = newEntity.render();

            if(target) {
                $(entityRender).insertBefore($(target));
            } else {
                that.container.append(entityRender);
            }

            that.addDragDropToItem(entityRender, position);

            return newEntity;

        };

        /**
         * Returns the active items in the list. Those marked for deletion are not counteted in
         * @returns {*}
         */
        that.getListLength = function () {
            // Gets all items that are not set for deletion
            // TODO: Find a more efficient way to check that
            var activeItems = $(that.imageEntities).filter(function (index, obj) {
                if (obj.getData().status != Model.statuses.DELETED)
                    return true;
            });

            return activeItems.length;
        };

        that.init();

        return that;
    }
});