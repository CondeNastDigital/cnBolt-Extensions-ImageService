define(['scribe', 'scribe-plugin-toolbar', 'scribe-plugin-cn-link-create', 'scribe-plugin-sanitizer'], function (Scribe, ScribePluginToolbar, CnLinkCreate, ScribePluginSanitizer) {

    /**
     * A component representing a form attribute.
     * The type parameter defines which template would be generated.
     * @param data {Object}
     * @param data.prefix {String}, a String prefix added to the field to ensure an unique name
     * @param data.definition {Object}, the attribute definition,
     * @param data.definition.type {text, textarea, select, checkbox, select, tag}
     * @param data.definition.label {String} Label of the attributes field
     * @param data.definition.value {String} Value for the checkbox option
     * @param data.definition.options {Object}, key:value object used for generation the select options
     * @param data.name {String} the field name
     * @param data.value {String}, the value saved in the Store for the current field
     * @param data.dataService {ImageServiceConnector} The backend connector, delivering data for the autocomplete
     */
    return function (data) {

        var that = this;

        /**
         * Set of available events that the system knows and the
         * class sends
         */
        var Events = data.config.events;

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
         * @type {ImageServiceConnector}
         */
        that.dataService = data.dataService;

        /**
         * The Field is ready and initialized
         * @type {boolean}
         */
        that.initialized = false;

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
            var bootstrapContainer = $('<div class="col-xs-12 col-sm-9 col-md-9 no-drag" ></div>');
            var select = $('<select data-name="' + fieldName + '" multiple ></select>');

            (fieldValue || []).forEach(function (el) {
                select.append($('<option value="' + el + '" selected>' + el + '</option>'));
            });

            // TODO: Find a way to move that code to the connector/service
            // After render, initiates the external Tag UI
            container.on(Events.ATTRIBUTERENDERED, function (event) {
                select.select2({
                    tags: true,
                    tokenSeparators: [',', ' '],
                    ajax: {
                        url: that.dataService.baseUrl + "/tagsearch",
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

            that.initialized = true;

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
                    '<div class="col-xs-12 col-sm-9 col-md-9 field-container no-drag" ></div>' +
                '</li>');

            var select = $('<select data-name="' + fieldName + '"></select>');
            for (x in options) {
                var option = $('<option value="' + x + '">' + data.definition.options[x] + '</option>');
                if (x == fieldValue)
                    option.attr('selected', 'selected');
                select.append(option);
            }

            container.find('.field-container').append(select);
            container.on('change', function (event) {
                that.value = $(event.target).val();
            });

            that.initialized = true;
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

            var container = $('<li class="row"><label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label><div class="col-xs-12 col-sm-9 col-md-9 no-drag" ><input type="checkbox"data-name="' + fieldName + '" value=""></div></li>');

            container.find('checkbox').val(fieldValue);
            container.find('checkbox').attr('value', fieldValue);
            
            container.on('click', function (event) {
                that.value = event.target.checked ? checkboxValue : '';
            });

            if (fieldValue == checkboxValue) {
                container.find('input').attr('checked', 'checked').prop('checked', true);
            }

            that.initialized = true;
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

            var container = $('<li class="row"><label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label><div class="col-xs-12 col-sm-9 col-md-9 no-drag" ><input type="text"data-name="' + fieldName + '" value=""></div></li>');

            container.find('input').val(fieldValue);
            container.find('input').attr('value', fieldValue);

            container.on('change', function (event) {
                that.value = $(event.target).val();
            });

            that.initialized = true;
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

            var container = $('<li class="row">' +
                '<label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label>' +
                '<div class="col-xs-12 col-sm-9 col-md-9">' +
                '<div class="toolbar no-drag">  ' +
                '<button data-command-name="bold"         type="button"><strong>Aa</strong></button>' +
                '<button data-command-name="italic"       type="button"><i>Aa</i></button>' +
                '<button data-command-name="cnCreateLink" type="button"><i class="fa fa-link" aria-hidden="true"></i></button>' +
                '</div>' +
                '<div contenteditable="true" class="no-drag imageservice-scribe" >' + fieldValue + '</div>' +
                '</div>' +
                '</li>');

            container.find('.toolbar').hide();

            window.document.addEventListener("selectionchange", function (event, data) {
                var selection = window.getSelection();
                // Chrome - srcElement, Firefox originalTarget
                var srcElement = event.srcElement || event.originalTarget;
                var element   = $(srcElement.activeElement);

                if (selection.isCollapsed)
                    element.siblings('.toolbar').hide();
                else
                    element.siblings('.toolbar').show();
            });

            container.on(Events.ATTRIBUTERENDERED, function (event, data) {

                // Use some plugins
                var toolbarElement = data.container.find('.toolbar')[0];
                var editorElement = data.container.find('.imageservice-scribe:first')[0];

                var scribe = new Scribe(editorElement);

                scribe.allowsBlockElements();
                scribe.setContent(fieldValue);

                scribe.use(ScribePluginToolbar(toolbarElement));
                scribe.use(CnLinkCreate());
                scribe.use(ScribePluginSanitizer(
                    {
                        tags: {
                            p: {},
                            b: {},
                            i: {},
                            br: {},
                            a: {
                                href: true,
                                target: '_blank',
                                rel: true
                            }
                        }
                    }));

                // transfer the change to the attribute store
                scribe.on('content-changed', function () {

                    var oldValue = that.value;
                    that.value = scribe.getHTML();

                    if(oldValue != scribe.getHTML())
                        container.trigger('change');

                });

                that.initialized = true;

            });

            return container;
        };

        return that;
    }
});