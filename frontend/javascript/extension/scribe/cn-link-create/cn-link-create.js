/**
 * TODO: Create a seprate cn SCRIBE Repository where all the custom plugins and
 * and scribe will be found.
 */
define(function() {

    /**
     * Class showing prompts
     * @param options
     * @returns {Prompt}
     * @constructor
     */
    var Prompt = (function(){
        var self = this;
        this.instance = null;
        this.patterns = [
            /*{
             attribute: 'href',
             pattern: /^((http(s)?)|(mailto)|(tel))\:\/\/)[a-z0-9_\-\.]+(\?.*)?/i
             }*/
        ];

        /**
         * Template of the window.
         * The extension looks for the .data inputs/selects and uses the data-name for mapping of the link-attributes
         */
        this.template = '<div class="prompt" style="position: fixed; top: calc(50% - 100px); left: calc(50% - 100px);">' +
            '  <ul>' +
            '      <li>' +
            '          Url: <input class="data form-control" name="scribe-link-href" data-name="href" value="">' +
            '      </li>' +
            '      <li>' +
            '          Target: ' +
            '          <select class="data form-control" data-name="target">' +
            '              <option value="">Same Window</option>' +
            '              <option value="_blank">New Window</option>' +
            '              <option value="_top">Parent Window</option>' +
            '          </select>' +
            '      </li>' +
            '      <li>' +
            '          Rel: ' +
            '          <select class="data form-control" data-name="rel">' +
            '              <option value="">Follow</option>' +
            '              <option value="nofollow">No follow</option>' +
            '              <!--option value="alternate">Alternate</option-->' +
            '              <!--option value="author">Author</option-->' +
            '              <!--option value="external">External</option-->' +
            '              <!--option value="tag">Tag</option-->' +
            '              <!--option value="prev">Previous</option-->' +
            '              <!--option value="next">Next</option-->' +
            '          </select>' +
            '      </li>' +
            '      <li style="display: none">' +
            '          id: <input class="data form-control" name="scribe-link-id" data-name="name" value="">' +
            '      </li>' +
            '  </ul>' +
            ' <div class="buttons">' +
            '    <button name="cancel" class="btn">Cancel</button><button name="ok" class="btn btn-success">Save</button>' +
            ' </div>' +
            '</div>';

        /**
         * Shows the window with initial values, that correspond to the data-name attributes
         * @param initial
         */
        this.show = function(options) {

            options.initial = options.initial || {};

            if(self.instance)
                this.remove();

            self.instance = $(self.template);
            $('body').append(self.instance);
            self.instance.find('.data').each(function(){
                var val = options.initial[$(this).attr('data-name')] || '';
                $(this).val(val);
                $(this).find('option[value="'+val+'"]').attr('selected','selected');
            });

            if(options.hasOwnProperty('onShow'))
                options.onShow();

            var data = $(self.instance).find('.data');

            $(self.instance).find('button[name="ok"]').on('click', function(event) {
                self.ok(event, data, options.onOK || null );
            });

            $(self.instance).find('button[name="cancel"]').on('click', function(event){
                self.cancel(event, data, options.onCancel || null)
            });

        };

        /**
         *
         * @returns {*}
         */
        this.validate = function() {

            $(self.instance).find('.data').removeClass('error');

            return self.patterns.reduce(function(isValid, check) {
                var element = $(self.instance).find('[data-name="'+check.attribute+'"]');
                var matched = String(element.val()).match(check.pattern);

                if(element && matched == null) {
                    element.addClass('error');
                    element.focus();
                }

                return isValid && matched != null;
            }, true)
        };

        /**
         * Hides the window
         */
        this.remove = function() {
            $(self.instance).remove();
        };

        /**
         * Ok action
         * @param event
         * @param data
         */
        this.ok = function(event, data, callback) {

            if(this.validate()) {
                if(typeof callback === 'function')
                    callback(event, data);

                self.remove();
            }

        };

        /**
         * Cancel action
         * @param event
         * @param data
         */
        this.cancel = function(event, data, callback) {

            if(typeof callback === 'function')
                callback(event, data);

            self.remove();
        };

        return this;
    })();

    /**
     * The real scribe Plugin
     */
    return function (options) {

        return function (scribe) {

            var linkPromptCommand = new scribe.api.CommandPatch('cnCreateLink');
            linkPromptCommand.nodeName = 'A';

            /**
             * The command actions
             * @param passedLink
             */
            linkPromptCommand.execute = function (passedLink) {
                // gets the selection
                var selection = new scribe.api.Selection();
                var range = selection.range;

                // checks if its an existing node
                var anchorNode = selection.getContaining(function (node) {
                    return node.nodeName === this.nodeName;
                }.bind(this));

                // constructs the propmp data
                var linkConfig = {
                    href: anchorNode ? anchorNode.href : '',
                    target: anchorNode ? anchorNode.target : '',
                    rel: anchorNode ? anchorNode.rel : '',
                    id: anchorNode ? anchorNode.id : ''
                };

                // converts the selection to text
                var linkText = window.getSelection().toString();

                // configures the prompt window
                Prompt.show({
                    initial: linkConfig,
                    onOK: function (event, data) {

                        // Reads the input data from the input fields
                        data.each(function (index, el) {
                            linkConfig[$(el).attr('data-name')] = $(el).val();
                        });

                        if (anchorNode !== undefined) {
                            range.selectNode(anchorNode);
                            selection.selection.removeAllRanges();
                            selection.selection.addRange(range);
                        }

                        if (selection.range) {

                            // creates a new link element
                            var aElement = document.createElement('a');

                            // populates the mapped values of the link
                            for (var attr in linkConfig)
                                if (linkConfig.hasOwnProperty(attr) && linkConfig[attr].length > 0)
                                    aElement.setAttribute(attr, linkConfig[attr]);

                            aElement.textContent = linkText;

                            scribe.transactionManager.run(function () {
                                // deletes the selected thing
                                selection.range.deleteContents();
                                // inserts the new link
                                if(aElement.href) {
                                    selection.range.insertNode(aElement);

                                    // Select the created link
                                    var newRange = document.createRange();
                                    newRange.setStartBefore(aElement);
                                    newRange.setEndAfter(aElement);

                                    selection.selection.removeAllRanges();
                                    selection.selection.addRange(newRange);

                                } else {
                                    selection.range.insertNode(document.createTextNode(linkText));
                                }
                            });

                        } else {
                            scribe.api.CommandPatch.prototype.execute.call(linkPromptCommand, value);
                        }
                    }
                });
            };

            /**
             * The command is always enabled
             * TODO: Extend this function to make a proper check
             * @returns {boolean}
             */
            linkPromptCommand.queryEnabled = function() {
                return true;
            };

            /**
             * Checks if the command is applicabale
             * @returns {boolean}
             */
            linkPromptCommand.queryState = function () {
                /**
                 * We override the native `document.queryCommandState` for links because
                 * the `createLink` and `unlink` commands are not supported.
                 * As per: http://jsbin.com/OCiJUZO/1/edit?js,console,output
                 */
                var selection = new scribe.api.Selection();
                return !!selection.getContaining(function (node) {
                    return node.nodeName === this.nodeName;
                }.bind(this));
            };

            scribe.commandPatches.cnCreateLink = linkPromptCommand;
        };
    };
});