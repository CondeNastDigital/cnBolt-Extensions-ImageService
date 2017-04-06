/**
 * Created by ralev on 05.04.17.
 */

define({
    /**
     * Definition of the system fields
     * @type {{tags: {type: string, label: string}}}
     */
    systemAttributes: {
        tags: {
            type: 'tag',
            label: 'Tags'
        }
    },
    labels: {

        finder: {
            fields: {
                itemFind: 'Search in the library'
            }
        },

        ImageServiceUploader: {
            button: {
                itemUpload: 'Upload Image'
            }
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

    },
    events: {
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

    }

});