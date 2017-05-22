/**
 * Created by ralev on 06.04.17.
 */
({
    name: 'CnImageService',
    baseUrl: './javascript',
    out: '../web/js/extension.js',
    wrap: {
        start: "(function() {",
        end: "}());"
    },
    paths: {
        "requirejs": "../node_modules/requirejs/require",
        "ImageServiceSettingsInterface": "interfaces/ImageServiceSettingsInterface",
        "ImageServiceAttributesFactory": "factories/ImageServiceAttributes",
        "ImageServiceImageModelFactory": "factories/ImageServiceImageModel",
        "ImageServiceListItemFactory": "factories/ImageServiceListItem",
        "ImageServiceConnector": "components/ImageServiceConnector",
        "ImageServiceUploader": "components/ImageServiceUploader",
        "ImageServiceSettings": "components/ImageServiceSettings",
        "ImageServiceFinder": "components/ImageServiceFinder",
        "ImageServicePresets": "components/ImageServicePresets",
        "ImageServiceMessaging": "components/ImageServiceMessaging",
        "ImageServiceList": "components/ImageServiceList",
        "ImageServiceConfig": "components/ImageServiceConfig",
        "ImageServiceErrors": "factories/ImageServiceErrors",
        "ImageServiceGlobals": "components/ImageServiceGlobals",
        "ImageServiceListItem": "components/ImageServiceListItem",
        "ImageServiceEntityAction": "components/ImageServiceEntityActions",
        "ImageServicePreview": "components/ImageServicePreview",
        "ImageServiceAttribute": "components/ImageServiceAttribute",
        "ImageServiceAttributes": "components/ImageServiceAttributes",
        "ImageServiceSirTrevor": "extension/sir-trevor/extension",
        "CnImageServiceBolt": "extension/bolt/extension"
    },
    include: ['requirejs','CnImageServiceBolt']
})