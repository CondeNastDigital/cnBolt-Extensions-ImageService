define(function () {

    /**
     * Component that shows messages inside the host element
     * @param data {Object}
     * @param data.host {Object} Where the new messages will appear
     * @param data.messageLife {Object} Time before the message automatically disappears
     * @param data.events {{error: string, warning: string, info: string}} Events for the diffetent message types.
     * is shown if some component fires an event on the host element
     *
     */
    return function(data) {

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
        that.events = {
            error: data.events.error || 'imageservice-error',
            warning: data.events.warning || 'imageservice-warning',
            info: data.events.info || 'imageservice-info'
        };

        /**
         * Constructor
         */
        that.init = function () {

            that.host.prepend(that.container);

            that.host.on(that.events.error, function (event, data) {
                that.error(data);
            });

            that.host.on(that.events.info, function (event, data) {
                that.info(data);
            });

            that.host.on(that.events.warning, function (event, data) {
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
    }
});