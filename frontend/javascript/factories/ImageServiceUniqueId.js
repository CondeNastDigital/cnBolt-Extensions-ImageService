define( function () {

    return function(prefix) {

        var that = this;

        that.prefix = prefix;

        that.generate =  function(input) {
            var result = (that.prefix? that.prefix + '_': '');
            return  result + String(input).replace(/[^a-z0-9\_\-]+/ig, '');
        };

        return that;

    }

});