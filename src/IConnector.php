<?php
namespace Bolt\Extension\CND\ImageService\Connector;

use Bolt\Application;
use Bolt\Extension\CND\ImageService\Image;
use Bolt\Menu\MenuEntry;

interface IConnector
{
    /* ---------------- Constants for service identification ----------------
    const ID = "cloudinary";
    const TITLE = "Cloudinary";
    const ICON = "http://res.cloudinary.com/cloudinary/image/upload/new_cloudinary_logo_square.png";
    const LINK = "http://www.cloudinary.com";
    */

    const FORMAT_JPG = "jpg";
    const FORMAT_PNG = "png";
    const FORMAT_GIF = "gif";
    const FORMAT_ICO = "ico";

    const MODE_SCALE = "scale"; // Resize exactly to the given width and height without retaining aspect ratio.
    const MODE_LIMIT = "limit"; // Resize inside given width and height and retain aspect ratio. Only if original is larger than target!
    const MODE_FILL  = "fill";  // Resize exactly to the given width and height and retain aspect ratio, cropping the image if necessary.
    const MODE_FIT   = "fit";   // Resize inside given width and height and retain aspect ratio.
    const MODE_PAD   = "pad";   // Resize exactly to the given width and height and retain aspect ratio, padding the image if necessary.

    const RESULT_TYPE_ERROR = "error";
    const RESULT_TYPE_WARN = "warn";
    const RESULT_TYPE_INFO = "info";

    const RESULT_CODE_ERRFILEINVALID = "fileinvalid";
    const RESULT_CODE_ERRFILESIZE    = "filesize";
    const RESULT_CODE_ERRNOFILE      = "nofile";
    const RESULT_CODE_ERRFILEEXT     = "fileext";
    const RESULT_CODE_ERRSTATUS      = "status";
    const RESULT_CODE_ERRUNKNOWN     = "unknown";

    /**
     * IConnector constructor.
     * @param Application $app
     * @param array $config
     */
    public function __construct(Application $app, $config);

    /**
     * Generate the image url for an image
     * @param string $mediaKey  image key
     * @param int $width        width in pixel
     * @param int $height       height in pixel
     * @param string $mode      mode for resizing/cropping
     * @param string $format    output format (jpg, png, etc...)
     * @param int $quality      compression quality in percent
     * @param array $options    custom options
     * @return string mixed
     */
    public function imageUrl(Image $image, $width, $height, $mode, $format, $quality, $options);

    /**
     * Update, delete or create all sent images according to their status
     * Will look inside $_FILES (or the Silex equivalent) for needed files
     * @param Image[] $images
     * @return bool
     */
    public function imageProcess(array $images, &$messages = []);

    /**
     * Search an image inside the service
     * @param $search
     * @return Image[]     an array with the imageKey and an array of attributes
     */
    public function imageSearch($search);

    /**
     * Search a tag
     * @param $search
     * @return array     an array with matching tags
     */
    public function tagSearch($search);

    // --- Supported Features

    /**
     * Return an array of all supported resizing mode constants.
     * @return array
     */
    public function supportedModes();

    /**
     * Return an array of all supported image format constants.
     * @return array
     */
    public function supportedFormats();

    // --- External service urls

    /**
     * generate the url to open the service's image editor
     * @param Image $image
     * @return false|string
     */
    public function adminImage($image);

    /**
     * generate the backend menu entries
     * @return MenuEntry[]
     */
    public function adminGlobal();

}