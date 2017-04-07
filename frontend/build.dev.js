/**
 * Created by ralev on 06.04.17.
 */
({
    name: 'cnImageService',
    baseUrl: './javascript',
    out: '../web/js/extension.js',
    wrap: false,
    paths: {
        "requirejs": "../node_modules/requirejs/require",
        "ImageServiceAttributesFactory": "factories/ImageServiceAttributes",
        "ImageServiceImageModelFactory": "factories/ImageServiceImageModel",
        "ImageServiceListItemFactory": "factories/ImageServiceListItem",
        "ImageServiceConnector": "classes/ImageServiceConnector",
        "ImageServiceUploader": "classes/ImageServiceUploader",
        "ImageServiceSettings": "classes/ImageServiceSettings",
        "ImageServiceFinder": "classes/ImageServiceFinder",
        "ImageServicePresets": "classes/ImageServicePresets",
        "ImageServiceMessaging": "classes/ImageServiceMessaging",
        "ImageServiceList": "classes/ImageServiceList",
        "ImageServiceConfig": "classes/ImageServiceConfig",
        "ImageServiceErrors": "classes/ImageServiceErrors",
        "ImageServiceGlobals": "classes/ImageServiceGlobals",
        "ImageServiceListItem": "classes/ImageServiceListItem",
        "ImageServiceEntityAction": "classes/ImageServiceEntityActions",
        "ImageServicePreview": "classes/ImageServicePreview",
        "ImageServiceAttribute": "classes/ImageServiceAttribute",
        "ImageServiceAttributes": "classes/ImageServiceAttributes",
        "ImageServiceSirTrevor": "extension/sir-trevor/extension"
    },
    include: ['requirejs']
})