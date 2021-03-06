define(function () {

    /**
     * Component for rendering an Actions block for an Item.
     * @param data {Object}
     * @param data.config {Object} Configuration class
     * @param data.config.events {{ITEMDELETE: String, ITEMEXCLUDE: String}} Event names that will be sent on actions
     * @param data.item {Object} The boject that will be sent along with the event
     */
    return function(data) {

        var that = this;
        var Events = data.config.events;

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
                    if (confirm("STOP! DANGER!!! \n\n This can lead to broken Images, if the deleted image has already been used somewhere else!!!\n\n To exclude the image from the list, without deleteing the source image, use the ”-” button. \n\n FOR GLOBAL DELETE press OK. "))
                        actionDelete.trigger(Events.ITEMDELETE, that.item);

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
                    action.trigger(Events.ITEMEXCLUDE, that.item);

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
    }
});