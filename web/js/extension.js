/**
 * ImageService Factory
 * @param data
 * @returns {{service: ImageServiceConnector, uploader: ImageServiceUploader, list: ImageServiceList}}
 * @constructor
 */
var CnImageService = function (data) {

    // ------- Definitions ---------

    /**
     * Error messages
     */
    var ImageServiceErrors = {
        fileexists:  'The file already exists. Please add it via the search field',
        filesize:    'The uploaded file is too big. Please choose a smaller one',
        nofile:      'No file has been fount, for the new image',
        fileext:     'The files extension is unknown',
        status:      'Invalid image status',
        unknown:     'Something went wrong. Try again and if the problem persits call an administrator',
        fileinvalid: 'File is invalid. Either too big or the of an unsuported type',
        accessdenied: 'You are not logged in!'
    };

    /**
     * Strings that are used in the application
     * @type {{button: {itemUpload: string}, fields: {itemFind: string}}}
     */
    var ImageServiceLabels = Object.assign({
        button: {
            itemUpload: 'Upload Image'
        },
        fields: {
            itemFind: 'Search in the library'
        },
        ImageServicePresets: {
            title: 'Defaults'
        },
        ImageServiceGlobals: {
            title: 'Globals'
        },
        ImageServiceSettings: {
            title: 'Settings'
        }

    }, data.labels);

    /**
     * Event on which the system reacts
     * @type {{LISTCHANGED: string, ITEMADDED: string, ITEMDELETED: string}}
     */
    var ImageServiceEVENTS = {

        LISTSAVED: 'imageservice-listsaved',
        LISTCHANGED: 'imageservice-listchanged',
        ITEMUPLOADED: 'imageservice-itemuploaded',
        ITEMCHANGED: 'imageservice-itemchanged',
        ITEMSAVED: 'imageservice-itemsaved',
        ITEMADDED: 'imageservice-itemadded',
        ITEMDELETED: 'imageservice-itemdeleted',
        ITEMDELETE: 'imageservice-itemdelete',
        ITEMTOGGLE: 'imageservice-itemtoggle',
        ITEMEXCLUDE: 'imageservice-itemexclude',
        ITEMEXCLUDED: 'imageservice-itemexcluded',
        PREVIEWREADY: 'imageservice-preview-ready',
        ATTRIBUTERENDERED: 'imageservice-attribute-rendered',
        MESSAGEERROR: 'imageservice-message-error',
        MESSAGEWARNING: 'imageservice-message-warning',
        MESSAGEINFO: 'imageservice-message-info',
        PRESETTERREGISTER: 'imageservice-presetter-register',
        SETTINGREGISTER: 'imageservice-setting-register'

    };

    /**
     * ImageService known Statuses
     * @type {{DELETED: string, NEW: string, CLEAN: string, DIRTY: string}}
     */
    var ImageServiceItemStatuses = {
        DELETED: 'deleted',
        NEW: 'new',
        CLEAN: 'clean',
        DIRTY: 'dirty',
        EXCLUDE: 'exclude'
    };

    /**
     * Item Model Factory
     * @type {{id: null, service: string, status: string, attributes: {}, tags: Array, options: Array, info: {height: null, width: null, size: null, format: null, source: null, created: null}}}
     */
    var ImageServiceImageModel = function(options){

        var that = this;
        var presetters = options.presetters || [];
        var host = options.host;

        var model = {

            id: null,
            service: "cloudinary",
            status: ImageServiceItemStatuses.NEW,
            attributes: {},
            tags: [],
            options: [],
            info: {
                height: null,
                width: null,
                size: null,
                format: null,
                source: null,
                created: null
            }

        };

        /**
         * Initiaation
         */
        that.init = function() {
            // Registers a listener for a new model presetter
            host.on(ImageServiceEVENTS.PRESETTERREGISTER, function(event, presetter){
                presetters.push(presetter);
            });
        };

        /**
         * Returns a full model containing all the default values
         * @param defaults
         * @returns {*}
         */
        that.create = function(defaults){

            defaults = defaults || {};

            var result = Object.assign({}, model);
            presetters.forEach(function(presetter){
                presetter.apply(result);
            });

            return Object.assign(result, defaults);
        };

        that.init();
    };


    var ImageServiceConfig = {
        /**
         * Definition of the system fields
         * @type {{tags: {type: string, label: string}}}
         */
        systemAttributes: {
            tags: {
                type: 'tag',
                label: 'Tags'
            }
        }
    };

    /**
     * Imageservice messaging
     * @param data
     * @returns {ImageServiceMessaging}
     * @constructor
     */
    var ImageServiceMessaging = function (data) {
        var that = {};

        /**
         * The Host Element where all events endup
         * @type {jQuery|HTMLElement|*|jQuery|HTMLElement|string}
         */
        that.host = data.host;

        /**
         * The number of milliseconds for which the message will be shown.
         * @type {number}
         */
        that.messageLife = data.messageLife || 1500000;

        /**
         * The element holding all shown messages
         * @type {jQuery|HTMLElement}
         */
        that.container = $('<div class="imageservice-message"></div>');

        /**
         * Known Message Types
         * @type {{ERROR: string, INFO: string, WARNING: string}}
         */
        that.messages = {
            error: data.messages.error,
            warning: data.messages.warning,
            info: data.messages.info
        };

        /**
         * Constructor
         */
        that.init = function () {

            that.host.append(that.container);

            that.host.on(that.messages.error, function (event, data) {
                that.error(data);
            });

            that.host.on(that.messages.info, function (event, data) {
                that.info(data);
            });

            that.host.on(that.messages.warning, function (event, data) {
                that.warning(data);
            });

        };

        /**
         * Removes a spcecific message
         * @param messageBox
         */
        that.remove = function (messageBox) {
            $(messageBox).animate({height: 0, opacity: 0}, 500, function () {
                messageBox.remove();
            });

        };

        /**
         * Adds the auto remove and remove on click functionality
         * @param element
         */
        that.addListeners = function (element) {

            setTimeout(
                function () {
                    that.remove(element);
                },
                that.messageLife
            );

            element.on('click', function () {
                that.remove(element);
            });

        };

        /**
         * Error message
         * @param message
         */
        that.error = function (message) {
            var messageBox = $('<div class="alert alert-danger alert-dismissible"><button type="button" class="close" data-dismiss="alert">×</button>' + message + '</div>');
            that.addListeners(messageBox);
            that.container.append(messageBox);

        };

        /**
         * Simple info
         * @param message
         */
        that.info = function (message) {
            var messageBox = $('<div class="alert alert-success alert-dismissible"><button type="button" class="close" data-dismiss="alert">×</button>' + message + '</div>');
            that.addListeners(messageBox);
            that.container.append(messageBox);
        };

        /**
         * Warning
         * @param message
         */
        that.warning = function (message) {
            var messageBox = $('<div class="alert alert-warning alert-dismissible"><button type="button" class="close" data-dismiss="alert">×</button>' + message + '</div>');
            that.addListeners(messageBox);
            that.container.append(messageBox);
        };

        that.init();

        return that;
    };

    /**
     * Connector to the backend
     * @param data
     * @returns {ImageServiceConnector}
     * @constructor
     */
    var ImageServiceConnector = function (data) {

        var that = this;

        /**
         * Used as a cache. Right now its only used to get the urls of the current saved items
         * @type {*|{}}
         */
        that.defaults = data.defaults || {};

        // Where the backened services reside
        that.location = data.location;

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
                url: that.location + '/imageprocess',
                data: formData,
                dataType: 'json',
                contentType: false,
                processData: false,
                async: async,

                success: function (response) {

                    if (response.success === true && response.messages && response.messages.length)
                        warningCallback(response.messages);

                    if(response.success === false && response.messages && response.messages.length)
                        return errorCallback(ImageServiceErrors[response.messages[0].code]);

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

            var deferred =  {};
            deferred.promise = new Promise(function(resolve, reject){
                deferred.resolve = resolve;
                deferred.reject = reject;
            });

            if (that.defaults.hasOwnProperty('urls') && that.defaults.urls.hasOwnProperty(imageId)) {
                deferred.resolve(that.defaults.urls[imageId]);
            } else {

                $.ajax({
                    url: that.location + '/imageurl',
                    data: {
                        imageid: imageId,
                        width: null,
                        height: null,
                        service: service
                    },
                    success: function(data) {
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

    };

    /**
     * Item Upload Class, creates a File upload form
     * @param data
     * @constructor
     */
    var ImageServiceUploader = function (data) {

        var that = this;

        /**
         * jQuery object which hosts all new elements generated by the Item Service
         * @type {jQuery|HTMLElement}
         */
        var host = data.host;

        /**
         * jQuery Object holding the upload field and all additional help elements if needed
         * @type {null}
         */
        var container = null;

        /**
         * the jQuery Upload Field
         * @type {null}
         */
        var uploadField = null;

        /**
         * The max filesize
         * @type {string|*|string|number}
         */
        var maxFileSize = data.maxFileSize || null;

        /**
         * Allowed extensions
         * @type {*|string[]}
         */
        var allowedExtensions = data.allowedExtensions || ['jpg', 'jpeg', 'png', 'gif'];

        /**
         * Class initialisation
         */
        that.init = function () {
            var uploadElement = that.render();
            host.append(uploadElement);
        };

        /**
         * File Validation checks the size and extension of the file
         * @param file
         * @returns {boolean}
         */
        that.validateFile = function (file) {

            if (!file)
                return true;

            if(maxFileSize && file.size > maxFileSize) {
                container.trigger(ImageServiceEVENTS.MESSAGEERROR, 'File size too big ' + file.size + ' File: ' + file.name);
                return false;
            } else if(allowedExtensions.indexOf(file.type.replace('image/', '')) < 0) {
                container.trigger(ImageServiceEVENTS.MESSAGEERROR, 'File type not known ' + file.type + ' File: ' + file.name);
                return false;
            } else {
                return true;
            }
        };

        /**
         * File processing - validates and triggers an ITEMADDED event
         * @param file
         */
        that.processFile = function (file) {

            if (!that.validateFile(file))
                return;

            var name = file.name;

            // Creates a copy of the Item model, as javascript only works with pointers.
            var newImage = modelFactory.create({
                id: name,
                info: {
                    source: null,
                    height: null,
                    width: null,
                    size: file.size,
                    format: file.type
                }
            });

            // The host is used as Events controller
            host.trigger(ImageServiceEVENTS.ITEMADDED, {
                item: newImage,
                file: file
            });

        };

        /**
         * Adds another upload field for multi-upload
         * @param element
         */
        that.addFieldListener = function (element) {
            element.on('change', function () {
                var filesCount = uploadField[0].files.length;

                for (var i = 0; i < filesCount; i++) {
                    that.processFile(uploadField[0].files[i]);
                }

                $(this).val(null);

                // Resets the Upload field
                //that.render();
            });
        };

        /**
         * Adds another upload field
         */
        that.addUploadField = function () {
            uploadField = $('<input name="files[]" type="file" multiple/>');
            that.addFieldListener(uploadField);
            container.append(uploadField);
        };

        /**
         * Renders the Upload container
         * @returns {*}
         */
        that.render = function () {

            var attributes = new ImageServiceAttributes({
                definitions: {
                    a: 'text'
                }
            });

            container = $('<span class="btn btn-primary fileinput-button"><i class="fa fa-plus"></i><span> '+ ImageServiceLabels.button.itemUpload +' </span></span>');
            that.addUploadField();
            return $('<div class="imageservice-uploader col-xs-12 col-md-2"></div>').append(container);
        };

        this.init();

    };

    /**
     * Item finder for the remote service
     * @param data
     * @constructor
     */
    var ImageServiceFinder = function (data) {
        var that = this;

        that.host = data.host;
        that.dataService = data.service;
        that.container = null;
        that.select = null;
        that.containerClass=data.containerClass;

        /**
         * The template of a single row in the suggestion list
         * @param state
         * @returns {*}
         */
        that.rowTemplate = function (state) {
            if (state.hasOwnProperty('id')) {
                var row = $('<div class="imageservice-finder-result col-xs-12"></div>');
                var preview = $('<div class="col-xs-3 preview" style="background-image: url(' + state.info.source + ');"></div>');
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
                    that.host.trigger(ImageServiceEVENTS.ITEMADDED, {item: jQuery.extend({}, event.params.data)});
                }
            });
        };

        /**
         * Initiates external UI functionality
         */
        that.initScelect2 = function () {

            that.select.select2({
                width: '100%',
                placeholder: ImageServiceLabels.fields.itemFind,
                allowClear: true,
                ajax: {
                    url: that.dataService.location + "/imagesearch",
                    dataType: 'json',
                    delay: 120,
                    data: function (params) {
                        return {
                            q: params.term.replace(/(^\s+)|(\s+$)/igm,''), // search term, trimmed
                            page: params.page
                        };
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
    };

    /**
     * Creates an editable list of items
     * @param data
     * @returns {ImageServiceList}
     * @constructor
     */
    var ImageServiceList = function (data) {

        var that = this;

        /**
         * Indicates a form change
         * @type {boolean}
         */
        that.dirty = false;

        /**
         * Backened connector service
         * @type {ImageServiceConnector|string}
         */
        that.dataService = data.service || new ImageServiceConnector();

        /**
         * jQuery element that hosts the current instance of the service
         * @type {jQuery|HTMLElement}
         */
        that.host = data.hostElement;

        /**
         * Object containing the definition of all posible extra fields
         * @type {*|{}}
         */
        that.attributes = data.attributes || {};

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
        that.init = function() {
            that.reset(data.items.items);
            that.addListeners();
        };

        /**
         * Resets the content of the list with new content
         * @param newItems
         */
        that.reset = function (newItems) {

            newItems = newItems || [];

            if(that.container != null)
                that.container.remove();

            that.container = $('<div class="imageservice-list"></div>');
            $(that.host).append(that.container);

            that.imageEntities = [];

            // Add the data to the internal array
            for (var i = 0; i < newItems.length; i++) {
                that.addItem(newItems[i]);
            }

            // Makes the list sortable
            if ($.fn.sortable) {
                that.container.sortable({
                    update: that.onListSorted
                });
            }
        };

        /**
         * Registers the listeners
         */
        that.addListeners = function () {

            // On list saved
            $(that.host).on(ImageServiceEVENTS.LISTSAVED, function (event, newItems) {
                that.dirty = false;
                that.reset(newItems.items);
            });

            // On element change
            $(that.host).on('change', function () {
                that.dirty = true;
            });

            // On new item added
            $(that.host).on(ImageServiceEVENTS.ITEMADDED, function (event, data) {
                if (data.hasOwnProperty('item')) {
                    var newItem = that.addItem(
                        data.item,
                        data.file || null
                    );

                    if (!newItem)
                        return;

                    var offsets = newItem.getOffsets();

                    that.container.animate({scrollTop: offsets.top}, 500);
                    that.dirty = true;
                }
            });

            $(that.host).on(ImageServiceEVENTS.ITEMDELETED, function (event, item) {
                that.dirty = true;
                if(item.getData().status == ImageServiceItemStatuses.EXCLUDE)
                    that.removeItem(item);
            });

            $(that.host).on(ImageServiceEVENTS.ITEMEXCLUDED, function (event, item) {
                that.dirty = true;
                that.removeItem(item);
            });

        };

        /**
         * TODO: Move to a Sorter class
         * @param event
         * @param ui
         */
        that.onListSorted = function (event, ui) {
            var ids = that.container.sortable('toArray');
            var newEntityArray = [];

            that.imageEntities.forEach(function (el) {
                var newIndex = ids.indexOf(el.getId());
                newEntityArray[newIndex] = el;
            });

            that.imageEntities = newEntityArray;
            that.dirty = true;

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
            if(itemIndex >=0) {
                that.imageEntities.splice(itemIndex, 1);
            }
        };

        /**
         * Adds a single item to the list
         * @param imageData
         * @param fileData
         * @returns {ImageServiceListItem}
         */
        that.addItem = function (imageData, fileData) {

            if (imageData.status == ImageServiceItemStatuses.DELETED){
                that.container.trigger(ImageServiceEVENTS.MESSAGEWARNING, 'Added image has a delete status');
                return;
            }

            // Limits the number of files in the list
            if (that.maxItems && that.getListLength() >= that.maxItems) {
                that.container.trigger(ImageServiceEVENTS.MESSAGEWARNING, 'Maximal number of list items reached.');
                return;
            }

            var newEntity = new ImageServiceListItem({
                item: jQuery.extend({}, imageData),
                file: fileData,
                definitions: that.attributes,
                dataService: that.dataService,
                prefix: that.host.attr('id') + '_' + that.imageEntities.length
            });

            that.imageEntities.push(newEntity);
            that.container.append(newEntity.render());

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
                if (obj.getData().status != ImageServiceItemStatuses.DELETED)
                    return true;
            });

            return activeItems.length;
        };

        that.init();

        return that;

    };

    /**
     * Creates a List-item containing a preview object, attributes and actions
     * @param data
     * @constructor
     */
    var ImageServiceListItem = function (data) {

        var that = this;

        /**
         * Has the info been changed flag
         * @type {boolean}
         */
        var dirty = false;

        /**
         * Item data
         * @type {*|{id: null, service: string, status: string, attributes: {}, tags: Array, options: Array, info: {height: null, width: null, size: null, format: null, source: null, created: null}}}
         */
        var item = modelFactory.create(data.item);

        /**
         * The source file for new Items
         * @type {*|CKEDITOR.ui.dialog.file|null}
         */
        var file = data.file || null;

        /**
         * Field definitions
         * @type {*|*|{type: string, label: string}}
         */
        var definitions = data.definitions;

        /**
         * Communication service with the backened
         * @type {*|ImageServiceConnector|string|ImageServiceConnector|string}
         */
        var dataService = data.dataService;

        /**
         * jQuery Object of the Entity
         * @type {null}
         */
        var container = null;

        /**
         * The unique id of the element
         * @type {string}
         */
        var id = '';

        /**
         * The preview object
         * @type {null}
         */
        var preview = null;

        /**
         * Attributes object
         * @type {null}
         */
        var attributes = null;

        /**
         * The actions object
         * @type {null}
         */
        var actions = null;

        /**
         * Initiates the object
         */
        that.init = function () {

            // creates an unique id of the entity
            id = data.prefix + '_' + item.id.replace(/[^a-z0-9\_\-]+/ig, '_');

            // Prepares the attributes
            definitions = jQuery.extend({}, data.definitions, ImageServiceConfig.systemAttributes);
            var attrValues = jQuery.extend({}, item.attributes, {tags: item.tags});

            // tries to retrieve the item url
            that.presetImage();

            // Loads the standart components
            container = $('<div id="' + id + '" class="col-xs-12 col-sm-12 col-md-12 imageservice-entity"></div>');
            actions = new ImageServiceEntityActions({});
            preview = new ImageServicePreview({item: item});
            attributes = new ImageServiceAttributes({
                prefix: id,
                values: attrValues,
                definitions: definitions,
                dataService: dataService
            });

            // adds the listeners
            that.addListeners();

            // Loads the source file
            if (file)
                that.loadTheFile();
        };

        /**
         * Returns the generated unique element id
         * @returns {string}
         */
        that.getId = function () {
            return id;
        };

        /**
         * Returns the Data of the Entity
         * @returns {*|{id: null, service: string, status: string, attributes: {}, tags: Array, options: Array, info: {height: null, width: null, size: null, format: null, source: null, created: null}}}
         */
        that.getData = function () {

            var attrValues = attributes.getValues();

            // Gets the internal values
            item.tags = attrValues.tags;

            for (var i in definitions)
                if(!ImageServiceConfig.systemAttributes.hasOwnProperty(i))
                    item.attributes[i] = attrValues[i];

            return item;
        };

        /**
         * Returns the loaded file. Needed when saving the new entities
         * @returns {*|CKEDITOR.ui.dialog.file|null}
         */
        that.getFile = function () {
            return file;
        };

        /**
         * Gets the offsets related to the parent element
         */
        that.getOffsets = function () {
            return {
                left: container[0].offsetLeft,
                top: container[0].offsetTop
            };
        };

        /**
         * Add listeners to react on attrbutes change and item delete
         */
        that.addListeners = function () {

            // change
            container.on('change', function (event) {
                that.onImageUpdate(event)
            });

            // delete
            container.on(ImageServiceEVENTS.ITEMDELETE, function () {
                that.onItemDelete(true);
            });

            // delete
            $(window).on(ImageServiceEVENTS.ITEMDELETED, function (event, item) {
                that.onItemDeleted(item);
            });

            // exclude
            container.on(ImageServiceEVENTS.ITEMEXCLUDE, function () {
                that.onItemDelete(false);
            });

            // exclude
            $(window).on(ImageServiceEVENTS.ITEMEXCLUDED, function (event, item) {
                that.onItemExcluded(item);
            });

        };

        /**
         * TODO: Move this logic to the Item service
         */
        that.presetImage = function () {

            if (!item.info.source){
                item.info.source = dataService.getImageUrl(item.id, item.service);
            }

            if (item.attributes instanceof Array) {
                item.attributes = {};
            }
        };

        /**
         * Code to execute on data update
         * @param event
         */
        that.onImageUpdate = function (event) {
            dirty = true;
            if (item.status != ImageServiceItemStatuses.NEW)
                item.status = ImageServiceItemStatuses.DIRTY;
        };

        /**
         * Code to execute on entity delete
         */
        that.onItemDelete = function (hard) {

            dirty = true;

            if(hard && item.status != ImageServiceItemStatuses.NEW) {
                // Delete existing already uploaded images
                item.status = ImageServiceItemStatuses.DELETED;
                var responseEvent = ImageServiceEVENTS.ITEMDELETED;
            }
            else {
                // Delete of images that not been uploaded
                var responseEvent = ImageServiceEVENTS.ITEMEXCLUDED;
            }

            that.hide( function () {
                container.trigger(responseEvent, that);
            });

        };

        /**
         * Code to execute on entity delete
         */
        that.onItemDeleted = function (deletedItem) {

            dirty = true;

            if(deletedItem.getData().id != item.id)
                return;

            if(item.status != ImageServiceItemStatuses.DELETED){
                item.status = ImageServiceItemStatuses.EXCLUDE;
                container.trigger(ImageServiceEVENTS.ITEMEXCLUDED, that);
            }

            that.hide();
        };


        /**
         * Code to execute on entity delete
         * still no other action required
         */
        that.onItemExcluded = function (excludedItem) {
            return;
        };

        /**
         * Hide the element
         */
        that.hide = function(success) {
            $(container).animate({height: 0, opacity: 0}, 300, function () {
                $(container).hide();
                if( typeof(success) == 'function' )
                    success();
            });
        };

        /**
         * Loads the File for the preview
         */
        that.loadTheFile = function () {
            var reader = new FileReader();
            reader.addEventListener("load", function () {
                var URL = window.URL || window.webkitURL || false;
                item.info.source = URL ? URL.createObjectURL(file) : reader.result;
                preview.update(item);
                container.trigger(ImageServiceEVENTS.PREVIEWREADY, item);
            });
            reader.readAsDataURL(file);
        };

        /**
         * Renders the Entity HTML
         * @returns {*}
         */
        that.render = function () {

            container.append(preview.render());
            container.append(attributes.render());
            container.append(actions.render());

            return container;
        };

        that.init();

    };

    /**
     * Creates a Block with Item Actions
     * @param data
     * @constructor
     */
    var ImageServiceEntityActions = function (data) {

        var that = this;

        /**
         * The item data of the entity
         */
        var item = data.item;

        /**
         * Generates the delete button
         * @returns {jQuery|HTMLElement}
         */
        that.renderDelete = function () {

            var actionDelete = $('<button class="btn delete btn-danger"><i class="fa fa-trash"></i></button>');

            actionDelete.on('click', function (event) {

                event.stopPropagation();
                event.preventDefault();

                if (confirm('Are you sure you want to delete this item from the service?'))
                    actionDelete.trigger(ImageServiceEVENTS.ITEMDELETE, that.item);

            });

            return actionDelete;
        };

        /**
         * Generates the delete button
         * @returns {jQuery|HTMLElement}
         */
        that.renderExclude = function () {

            var action = $('<button class="btn btn-warning remove"><i class="fa fa-minus"></i></button>');

            action.on('click', function (event) {

                event.stopPropagation();
                event.preventDefault();

                if (confirm('Are you sure you want to exclude this item from the list?'))
                    action.trigger(ImageServiceEVENTS.ITEMEXCLUDE, that.item);

            });

            return action;
        };

        /**
         * Renders HTML containing the actions
         * @returns {jQuery|HTMLElement}
         */
        that.render = function () {
            var actions = $('<div class="col-xs-12 col-sm-1 col-md-1 imageservice-entity-actions"></div>');
            actions.append(that.renderDelete());
            actions.append(that.renderExclude());
            return actions;
        }

    };

    /**
     * Creates a HTML preview of an Item
     * @param data
     * @returns {ImageServicePreview}
     * @constructor
     */
    var ImageServicePreview = function (data) {

        var that = this;
        var item = data.item;
        var preview = null;
        var container = null;

        /**
         * Tries to get the item path form the
         */
        that.init = function () {

            container = $('<div class="col-xs-12 col-sm-3 col-md-3 imageservice-preview"></div>');
            preview = $('<img/>');

            that.update(item);

            preview.on('click', function(){
                $(this).trigger(ImageServiceEVENTS.ITEMTOGGLE);
            });

            container.append(preview);

        };

        /**
         * Updates the preview data
         * @param newImage
         */
        that.update = function (newImage) {

            item = newImage;

            if(item.info.source instanceof Promise && item.status != ImageServiceItemStatuses.NEW) {
                item.info.source.then(function(url){
                    preview.attr('src', url);
                    item.info.source = url;
                });
            } else if(!(item.info.source instanceof Promise)) {
                preview.attr('src', item.info.source);
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
    };

    /**
     * Generates editable item attributes fields
     * @param data
     * @constructor
     */
    var ImageServiceAttributes = function (data) {

        var that = this;
        that.values = data.values || [];
        that.prefix = data.prefix || '';
        that.definitions = data.definitions;
        that.attributes = [];
        that.dataService = data.dataService;
        that.container = null;

        that.getValues = function () {
            return that.values;
        };

        that.setValues = function(values) {
            that.attributes.forEach(function(el){
                el.setValue(values[el.name] || el.value);
            });
        };

        /**
         * Creates the attributes of the item
         */
        that.init = function () {
            for (var key in that.definitions) {
                var definition = that.definitions[key];
                that.attributes.push(
                    new ImageServiceAttribute({
                        prefix: that.prefix,
                        value: that.values[key] || '',
                        definition: definition,
                        name: key,
                        dataService: that.dataService
                    })
                );
            }
        };

        /**
         * Gets the item
         * @returns {{}|*|values|_.values}
         */
        that.getValues = function () {

            that.attributes.forEach(function (attribute) {
                that.values[attribute.name] = attribute.getValue();
            });

            return that.values;
        };

        /**
         * Generates the HTML object containing the editable attributes
         * @param imageData
         * @param fieldDefinitions
         * @returns {jQuery|HTMLElement}
         */
        that.render = function (imageData, fieldDefinitions) {

            that.container = $('<ul class="col-xs-12 col-sm-8 col-md-8 imageservice-attributes"></ul>');

            that.attributes.forEach(function (el, index) {
                that.container.append(el.render());
                el.trigger(ImageServiceEVENTS.ATTRIBUTERENDERED, el);
            });

            return that.container;
        };

        that.init();

    };

    /**
     * Item Attribute
     * @param data
     * @constructor
     */
    var ImageServiceAttribute = function (data) {

        var that = this;

        /**
         * A prefix that guaranties uniqueness of the field
         * @type {string}
         */
        that.prefix = data.prefix || '';

        /**
         * Definitions of the attribute
         */
        that.definition = data.definition;

        /**
         * Attribute name
         * @type {*|c}
         */
        that.name = data.name;

        /**
         * The attribute value
         */
        that.value = data.value;

        /**
         * HTML of the field - jQuery object
         * @type {null}
         */
        that.container = null;

        /**
         * Connector/service to the backend - needed for the select2 tag UI
         * @type {*|ImageServiceConnector|string|ImageServiceConnector|string|*|ImageServiceConnector|string|string|ImageServiceConnector}
         */
        that.dataService = data.dataService;

        /**
         * Triggers an event on the attribute
         * @param event
         * @param data
         */
        that.trigger = function (event, data) {
            that.container.trigger(event, data);
        };

        /**
         * Return the attribute value
         * @returns {*|jQuery}
         */
        that.getValue = function () {
            return that.value;
        };

        /**
         * Return the attribute value
         * @returns {*|jQuery}
         */
        that.setValue = function (value) {
            that.value = value;
            that.render();
        };

        /**
         * Generates a string for the label
         * @returns {*|c}
         */
        that.generateLabel = function () {
            return that.definition.label || that.name
        };

        /**
         * Generates a string for the field name
         * @returns {string}
         */
        that.generateFieldName = function () {
            return that.prefix + '_' + that.name;
        };

        /**
         * Builds the Attribute object based on the attribute definitions
         * @returns {*}
         */
        that.render = function () {

            if (that.hasOwnProperty(that.definition.type)) {
                that.container = that[that.definition.type](that.value, that.definition);
            }

            return that.container;
        };

        /**
         * Generates a tag field
         * @param fieldValue
         */
        that.tag = function (fieldValue) {

            var fieldName = that.generateFieldName();
            var fieldLabel = that.generateLabel();

            var container = $('<li class="row"></li>');
            var label = $('<label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label>');
            var bootstrapContainer = $('<div class="col-xs-12 col-sm-9 col-md-9" ></div>');
            var select = $('<select name="' + fieldName + '" multiple ></select>');

            (fieldValue || []).forEach(function (el) {
                select.append($('<option value="' + el + '" selected>' + el + '</option>'));
            });

            // TODO: Find a way to move that code to the connector/service
            // After render, initiates the external Tag UI
            container.on(ImageServiceEVENTS.ATTRIBUTERENDERED, function (event) {
                select.select2({
                    tags: true,
                    tokenSeparators: [',', ' '],
                    ajax: {
                        url: that.dataService.location + "/tagsearch",
                        dataType: 'json',
                        delay: 100,
                        data: function (params) {
                            return {
                                q: params.term, // search term
                                page: params.page
                            };
                        },
                        processResults: function (data, params) {

                            params.page = params.page || 1;

                            var items = [];

                            for (var i = 0; i < data.items.length; i++) {
                                items.push({
                                    id: data.items[i],
                                    text: data.items[i]
                                });
                            }

                            return {
                                results: items,
                                pagination: {
                                    more: true
                                }
                            };
                        },
                        cache: false
                    }
                    //templateResult: function(state) { return $('<span>'+(state.text || state)+'</span>'); },
                    //templateSelection: function(state) { return state.text || state; }
                });
            });

            // Updates the object value on change of tags
            select.on('change', function () {
                that.value = $(this).val();
            });

            // Appneds the components of the field
            container.append(label);
            bootstrapContainer.append(select);
            container.append(bootstrapContainer);

            return container;
        };

        /**
         * Generates a simple input field
         * @param fieldValue
         * @returns {jQuery|HTMLElement}
         */
        that.select = function (fieldValue) {

            var fieldName = that.generateFieldName();
            var fieldLabel = that.generateLabel();
            var options = data.definition.options || [];

            var container = $('<li class="row">' +
                '<label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label>' +
                '<div class="col-xs-12 col-sm-9 col-md-9 field-container" ></div>' +
                '</li>');

            var select = $('<select name="'+fieldName+'"></select>');
            for(x in options ){
                var option = $('<option value="'+x+'">'+data.definition.options[x]+'</option>');
                if(x == fieldValue)
                    option.attr('selected','selected');
                select.append(option);
            }

            container.find('.field-container').append(select);
            container.on('change', function (event) {
                that.value = $(event.target).val();
            });

            return container;
        };

        /**
         * Generates a simple input field
         * @param fieldValue
         * @returns {jQuery|HTMLElement}
         */
        that.checkbox = function (fieldValue) {

            var fieldName = that.generateFieldName();
            var fieldLabel = that.generateLabel();
            var checkboxValue = that.definition.value || '';

            var container = $('<li class="row"><label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label><div class="col-xs-12 col-sm-9 col-md-9" ><input type="checkbox" name="' + fieldName + '" value="' + checkboxValue + '"></div></li>');

            container.on('click', function (event) {
                console.debug(4);
                that.value = event.target.checked ? checkboxValue: '' ;
            });

            if(fieldValue == checkboxValue)
                container.find('input').attr('checked','checked');

            return container;
        };

        /**
         * Generates a simple input field
         * @param fieldValue
         * @returns {jQuery|HTMLElement}
         */
        that.text = function (fieldValue) {

            var fieldName = that.generateFieldName();
            var fieldLabel = that.generateLabel();

            var container = $('<li class="row"><label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label><div class="col-xs-12 col-sm-9 col-md-9" ><input type="text" name="' + fieldName + '" value="' + fieldValue + '"></div></li>');

            container.on('change', function (event) {
                that.value = $(event.target).val();
            });

            return container;
        };

        /**
         * Generates a textarea
         * @param fieldValue
         * @returns {jQuery|HTMLElement}
         */
        that.textarea = function (fieldValue) {

            var fieldName = that.generateFieldName();
            var fieldLabel = that.generateLabel();

            var container = $('<li class="row"><label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label><div class="col-xs-12 col-sm-9 col-md-9"><textarea name="' + fieldName + '" >' + fieldValue + '</textarea></div></li>');

            container.on('change', function (event) {
                that.value = $(event.target).val();
            });

            return container;
        };

        return that;
    };


    /**
     * A proesetter responsible for the default attribute values of the uploaded images
     * @param data
     * @constructor
     */
    var ImageServicePresets = function (data) {

        var that = this;

        // Where the UI resides
        that.container = null;
        // The host where the events go
        that.host = data.host;

        // Creates an attributes object that will be used for the UI
        var attributes = new ImageServiceAttributes({
            definitions: jQuery.extend({}, data.attributes, ImageServiceConfig.systemAttributes),
            dataService: data.service,
            values: data.values
        });

        this.getIdentifier = function() {
            return 'ImageServicePresets'
        };

        this.getValues = function() {
            return attributes.getValues();
        };

        this.setValues = function(values) {
            return attributes.setValues(values);
        };

        /**
         * Makes the preset changes of the model
         * @param model
         * @returns {*}
         */
        this.apply = function(model) {

            if(!model.hasOwnProperty('attributes'))
                return model;

            var values = attributes.getValues();
            model.tags = values.tags;

            return Object.assign(model.attributes, values);
        };

        /**
         * Renders the frontend part
         * @returns {null|jQuery|HTMLElement|*}
         */
        this.render = function() {

            if(that.container)
                that.container.remove();

            that.container = $('<div class="imageservice-attributes-global"><h5>'+ImageServiceLabels.ImageServicePresets.title+'</h5><hr/></div>');
            that.container.append(attributes.render());
            host.append(that.container);

            return that.container;
        };

        /**
         * Initialization
         */
        this.init = function() {
            that.host.trigger(ImageServiceEVENTS.PRESETTERREGISTER, this);
            that.host.trigger(ImageServiceEVENTS.SETTINGREGISTER, this);
        };

        this.init();

    };

    /**
     * A proesetter responsible for the default attribute values of the uploaded images
     * @param data
     * @constructor
     */
    var ImageServiceGlobals = function (data) {

        var that = this;

        // Where the UI resides
        that.container = null;
        // The host where the events go
        that.host = data.host;

        // Creates an attributes object that will be used for the UI
        var attributes = new ImageServiceAttributes({
            definitions: data.attributes,
            dataService: data.service,
            values: data.values
        });

        this.getIdentifier = function() {
            return 'ImageServiceGlobals'
        };

        this.getValues = function() {
            return attributes.getValues();
        };

        this.setValues = function(values) {
            attributes.setValues(values);
            return this.render();
        };

        /**
         * Renders the frontend part
         * @returns {null|jQuery|HTMLElement|*}
         */
        this.render = function() {

            if(that.container)
                that.container.remove();

            that.container = $('<div class="imageservice-attributes-global"><h5>'+ImageServiceLabels.ImageServiceGlobals.title+'</h5><hr/></div>');
            that.container.append(attributes.render());
            host.append(that.container);

            return that.container;
        };

        /**
         * Initialization
         */
        this.init = function() {
            that.host.trigger(ImageServiceEVENTS.SETTINGREGISTER, this);
        };

        this.init();

    };

    /**
     * Block containing the settings for the imageservice block
     * @param options
     * @constructor
     */
    var ImageServiceSettings = function(options) {

        var that = this;
        var host = options.host;
        var components = [];
        var container = null;
        var store = options.data || {};

        this.init = function() {

            var containerControl = $('<div class="col-sm-1 col-xs-12 imageservice-settings-trigger"><button class="btn btn-secondary"><i class="fa fa-cogs" aria-hidden="true"></i></button></div>');
            container = $('<div class="col-xs-12 imageservice-settings" ><h4>'+ImageServiceLabels.ImageServiceSettings.title+'</h4></div>');

            containerControl.on('click', function(event){
                event.preventDefault();
                event.stopPropagation();

                $(container).animate({ height: 'toggle' });
            });

            host.append(containerControl);
            host.append(container.hide());

            host.on(ImageServiceEVENTS.SETTINGREGISTER, function(event, data){
                data.setValues(store[data.getIdentifier()] || {});
                that.addComponent(data);
            });

        };

        this.addComponent = function(component) {
            var newElement = $('<div class="imageservice-settings-component"></div>').append(component.render());
            components.push(component);
            container.append(newElement);
        };

        this.getData = function() {

            components.forEach(function(el){
                store[el.getIdentifier()] = el.getValues();
            });

            return store;
        };

        this.init();

    };

    // ------ Factory --------

    /**
     * Filed Holding the generated JSON
     * @type {jQuery|HTMLElement}
     */
    var store = $(data.dataElement);
    var storeJson = JSON.parse(store.val());

    /**
     * Host HTML Element holding all new generated elements
     * Also used as an Event-Arena
     * @type {jQuery|HTMLElement}
     */
    var host = $(data.hostElement);

    /**
     * Constructor
     */
    var init = function () {
        host.addClass('imageservice-container');
        store.hide();
        ImageServiceErrors = jQuery.extend(ImageServiceErrors, data.errors);
    };

    var modelFactory = new ImageServiceImageModel({
        host: host
    });

    /**
     * Backend connector
     * @type {ImageServiceConnector}
     */
    var service = new ImageServiceConnector({
        defaults: data.cache,
        location: data.serviceUrl
    });

    /**
     * Uploader of items
     * @type {ImageServiceUploader}
     */
    var uploader = new ImageServiceUploader({
        host: host,
        maxFileSize: data.maxFileSize,
        service: service
    });

    /**
     * Finds images on the rmeote service and adds them to the list
     * @type {ImageServiceFinder}
     */
    var finder = new ImageServiceFinder({
        host: host,
        service: service
    });

    /**
     * Block containing some settings blocks.
     * The block should have
     * getValues
     * setValues
     * getIdentifier
     * render
     */
    var settings = new ImageServiceSettings({
        host: host,
        data: storeJson.settings
    });

    /**
     * Global settings concerning the instance
     */
    if(Object.keys(data.globals || {}).length)
        var globals = new ImageServiceGlobals({
            host: host,
            parentContainer: null,
            attributes: data.globals,
            service: service,
            values: {}
        });

    /**
     * Presets of the Image attributes
     */
    if(Object.keys(data.attributes || {} ).length)
        var presets = new ImageServicePresets({
            host: host,
            parentContainer: null,
            attributes: data.attributes,
            service: service,
            values: {}
        });

    /**
     * Massage UI
     * @type {ImageServiceMessaging}
     */
    var messaging = new ImageServiceMessaging({
        host: host,
        messages: {
            error: ImageServiceEVENTS.MESSAGEERROR,
            warning: ImageServiceEVENTS.MESSAGEWARNING,
            info: ImageServiceEVENTS.MESSAGEINFO
        }
    });

    /**
     * List of items
     * @type {ImageServiceList}
     */
    var list = new ImageServiceList({
        service: service,
        hostElement: host,
        items: storeJson,
        attributes: data.attributes,
        maxItems: data.maxFiles || null
    });

    /**
     * Action that have to be executed on save. It modifies the event in order to
     * make sure that the ajax call has finished before the actual saving takes place.
     * This set of actions have to happen first.
     * @param event
     * @returns {*}
     */
    var onSave = function (event) {

        if (list.dirty) {
            // Stop the initial save process - syncronious save
            event = event || new Event(ImageServiceEVENTS.LISTSAVED);
            event.preventDefault();
            event.stopImmediatePropagation();

            // Gets the current list data
            var data = list.getData();
            var settingsValues = settings.getData();
            console.debug(1);

            // Invokes the Backend-Connector Save
            service.imageSave({
                async: false, // unfortunately, this functionality is deprecated
                items: data.items,
                files: data.files,

                // Updates the JSON-holding element and recalls the save event
                callback: function (newItems) {
                    console.debug(settingsValues);
                    var stringified = JSON.stringify({items: newItems, settings: settingsValues});
                    console.debug(stringified);
                    // transforms the response to json for the backend-save
                    store.val(stringified);
                    // informs the host that the list has been saved
                    $(host).trigger(ImageServiceEVENTS.LISTSAVED, stringified);
                    // reinitiates the event
                    $(event.target).trigger(event.type);
                },

                // Warning handler, the saving process is not cancelled!
                warning: function(messages) {
                    messages.forEach(function(message){
                        console.warn(message);
                        host.trigger(
                            ImageServiceEVENTS.MESSAGEWARNING,
                            ImageServiceErrors[message.code] + ' - ' + message.id
                        );
                    });
                },

                // Error handler, the saving process is cancelled
                error: function(error) {
                    console.error(error);
                    host.trigger(ImageServiceEVENTS.MESSAGEERROR, error);
                }
            });
        }

    };

    init();

    return {
        service: service,
        uploader: uploader,
        finder: finder,
        list: list,
        messaging: messaging,
        onSave: onSave
    }
};