<?php
namespace Bolt\Extension\CND\ImageService\Service;
use Bolt;
use Bolt\Application;
use Bolt\Extension\CND\ImageService\Connector\IConnector;

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

    public function imageUrl($data, $width, $height, $mode = false, $format = false, $quality = false, $options = array()){

        $service  = isset($data["service"]) ? $data["service"] : false;
        $mediakey = isset($data["imagekey"]) ? $data["imagekey"] : false;

        $defaults = $this->config["defaults"];

        $mode    = $mode    ? $mode    : $defaults["mode"];
        $format  = $format  ? $format  : $defaults["format"];
        $quality = $quality ? $quality : $defaults["quality"];
        $options = $options ? $options : $defaults["options"];

        if(!$service || !$mediakey || !isset($this->connectors[$service]))
            return null;

        /* @var IConnector $connector */
        $connector = $this->connectors[$service];

        return $connector->imageUrl($mediakey, $width, $height, $mode, $format, $quality, $options);
    }

}