<?php
namespace Bolt\Extension\CND\ImageService\Connector;

use Bolt\Application;
use Bolt\Extension\CND\ImageService\Image;
use Bolt\Menu\MenuEntry;

class CloudinaryConnector implements IConnector
{
    const ID = "cloudinary";
    const TITLE = "Cloudinary";
    const ICON = "http://res.cloudinary.com/cloudinary/image/upload/new_cloudinary_logo_square.png";
    const LINK = "http://www.cloudinary.com";

    /* @var Application $container */
    protected $container = null;

    /* @var array $config */
    protected $config = [];

    /**
     * @inheritdoc
     */
    public function __construct(Application $app, $config){
        $this->config = $config;
        $this->container = $app;
    }

    /**
     * @inheritdoc
     */
    public function imageUrl(Image $image, $width, $height, $mode, $format, $quality, $options)
    {
        $mode_map = [
            self::MODE_SCALE => "c_scale",
            self::MODE_FILL => "c_fill",
            self::MODE_PAD => "c_pad",
            self::MODE_LIMIT => "c_limit",
            self::MODE_FIT => "c_fit",
        ];

        // Base URL
        $url = $this->config["base-delivery-url"]."/image/upload/";

        // Apply modifiers
        $modifiers = [];
        if($mode && isset($mode_map[$mode])) // Resize mpode
            $modifiers[] = $mode_map[$mode];
        if((int)$width)                      // Width
            $modifiers[] = "w_".(int)$width;
        if((int)$height)                     // Height
            $modifiers[] = "h_".(int)$height;
        $url .= $modifiers ? implode(",",$modifiers)."/" : "";

        // Image
        $url .= $image->id.".";

        // Format
        $url .= $format && in_array($format, $this->supportedFormats()) ? $format : "jpg";

        return $url;
    }

    /**
     * @inheritdoc
     */
    public function imageProcess(array $images)
    {
        // TODO: Implement imageUpload() method.
    }

    /**
     * @inheritdoc
     */
    public function imageSearch($search)
    {
        // TODO: Implement imageSearch() method.
    }

    /**
     * @inheritdoc
     */
    public function supportedModes()
    {
        return [
            self::MODE_FILL,
            self::MODE_FIT,
            self::MODE_LIMIT,
            self::MODE_PAD,
            self::MODE_SCALE
        ];
    }

    /**
     * @inheritdoc
     */
    public function supportedFormats()
    {
        return [
            self::FORMAT_GIF,
            self::FORMAT_ICO,
            self::FORMAT_JPG,
            self::FORMAT_PNG
        ];
    }

    /**
     * @inheritdoc
     */
    public function adminImage($imageKey)
    {
        // TODO: Implement adminImage() method.
    }

    /**
     * @inheritdoc
     */
    public function adminGlobal()
    {
        $items = [];

        $medialibrary = new MenuEntry('cloudinary-admin-ui', '//cloudinary.com/console/media_library');
        $medialibrary->setLabel("Cloudinary Media")
            ->setIcon('fa:cloud')
            ->setPermission('editor');

        return [ $medialibrary ];
    }
}