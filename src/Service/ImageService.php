<?php
namespace Bolt\Extension\CND\ImageService\Service;
use Bolt;
use Bolt\Application;
use Bolt\Extension\CND\ImageService\Connector\IConnector;
use Bolt\Extension\CND\ImageService\Image;

class ImageService {

    /* @var IConnector[] $connectors */
    protected $connectors = array();

    /**
     * Set up the object.
     *
     * @param Application $app
     * @param array              $config
     */
    public function __construct(Application $app, $config) {
        $this->container = $app;
        $this->config = $config;

        // Init service connectors
        foreach($this->config["connectors"] as $key => $config){

            if(!isset($config["class"]))
                continue;

            if(!class_exists($config["class"]))
                continue;

            $connector = new $config["class"]($app, $config);
            if(!$connector instanceof IConnector)
                continue;

            $this->connectors[$key] = $connector;
        }
    }

    public function getServiceMenu(){
        $entries = [];

        foreach($this->connectors as $connector){
            $entries = $entries + $connector->adminGlobal();
        }

        return $entries;
    }

    public function imageUrl(Image $image, $width, $height, $mode = false, $format = false, $quality = false, $options = array()){
        $defaults = $this->config["defaults"];

        $mode    = $mode    ? $mode    : $defaults["mode"];
        $format  = $format  ? $format  : $defaults["format"];
        $quality = $quality ? $quality : $defaults["quality"];
        $options = $options ? $options : $defaults["options"];

        if(!$image->service || !$image->id || !isset($this->connectors[$image->service]))
            return null;

        /* @var IConnector $connector */
        $connector = $this->connectors[$image->service];

        return $connector->imageUrl($image, $width, $height, $mode, $format, $quality, $options);
    }

}