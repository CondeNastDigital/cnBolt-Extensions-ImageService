/**
 * Created by ralev on 05.04.17.
 */

define(function () {

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
    }
});