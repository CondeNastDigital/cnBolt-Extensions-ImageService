<?php
namespace Bolt\Extension\CND\ImageService;


use JsonSerializable;
use Symfony\Component\Config\Definition\Exception\Exception;

/**
 * Data storage class for images
 *
 * @property string $id
 * @property string $service
 * @property string $status
 * @property string[] $attributes
 * @property string[] $tags
 * @property string[] $options
 * @property string[] $info
 */
class Image implements JsonSerializable {

    const INFO_HEIGHT = "height";
    const INFO_WIDTH = "width";
    const INFO_SIZE = "size";
    const INFO_FORMAT = "format";
    const INFO_SOURCE = "source";
    const INFO_CUSTOM = "custom";
    const INFO_CREATED = "created";
    const INFO_CACHED = "cached";

    const STATUS_CLEAN = "clean";       // image is in sync with the local database and the image service
    const STATUS_NEW = "new";           // image needs to be created in local database and image service (The id can be left empty and will be set by the image service!)
    const STATUS_DIRTY = "dirty";       // image needs to be updated in local database and image service
    const STATUS_DELETED = "deleted";   // image needs to be deleted (Will be removed from local database but may not be deleted from image service at discretion of the service)

    protected static $info_fields = [self::INFO_HEIGHT,self::INFO_WIDTH,self::INFO_SIZE,self::INFO_FORMAT,self::INFO_SOURCE,self::INFO_CREATED,self::INFO_CACHED,self::INFO_CUSTOM];

    protected $id;
    protected $service;
    protected $attributes = [];
    protected $tags = [];
    protected $options = [];
    protected $status = self::STATUS_CLEAN;

    protected $info = [];


    /**
     * Image constructor.
     * @param string $id
     * @param string $service
     */
    public function __construct($id, $service){
        $this->id = $id ? $id : null;
        $this->service = $service ? $service : "unknown";
    }

    /**
     * get the value of one of the classes properties
     * @param $name
     * @return array|string
     */
    public function __get($name) {
        switch($name){
            case "id":
            case "service":
            case "status":
            case "attributes":
            case "tags":
            case "options":
            case "info":
                return $this->{$name};
            default:
                throw new Exception("Unknown property '{$name}' requested");
        }
    }

    /**
     * set the value of one of the classes properties
     * @param $name
     * @param $value
     */
    public function __set($name, $value){
        switch($name){
            // single fields
            case "id":
            case "service":
            case "status":
            $this->{$name} = $value;
                break;
            // dynamic key/value arrays
            case "options":
            case "attributes":
                $this->{$name} = is_array($value) ? $value : array();
                break;
            // dynamic value arrays
            case "tags":
                $this->tags = $value ? $value : array();
                asort($this->tags);
                $this->tags = array_unique($this->tags);
                $this->tags = array_values($this->tags);
                break;
            // fixed key/value arrays
            case "info":
                if(is_array($value))
                    $this->info = array_intersect_key($value, array_flip(self::$info_fields)) + $this->info;
                break;
            default:
                throw new Exception("Unknown property '{$name}' requested");
        }
    }

    public function __isset($name){
        return in_array($name, array("id", "service", "options", "attributes", "tags"));
    }

    /**
     * Return the string (json) encoded value
     * @return array
     */
    public function jsonSerialize() {
        $output = [
            "id"         => $this->id,
            "service"    => $this->service,
            "status"     => $this->status,
            "attributes" => $this->attributes,
            "tags"       => $this->tags,
            "options"    => $this->options,
            "info"       => $this->info
        ];

        return $output;
    }

    public static function create($input){
        
        $input = $input + [
            "id"         => null,
            "service"    => null,
            "status"     => null,
            "attributes" => [],
            "tags"       => [],
            "options"    => [],
            "info"       => []
        ];        
        
        $image = new self($input["id"], $input["service"]);

        $image->__set("attributes", $input["attributes"]);
        $image->__set("tags",       $input["tags"]);
        $image->__set("options",    $input["options"]);
        $image->__set("status",     $input["status"]);
        $image->__set("info",       $input["info"]);

        return $image;
    }

    public function __toString() {
        return $this->id;
    }

}
