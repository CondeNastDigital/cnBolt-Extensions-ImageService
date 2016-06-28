<?php
namespace Bolt\Extension\CND\ImageService;


use JsonSerializable;
use Symfony\Component\Config\Definition\Exception\Exception;

/**
 * Data storage class for images
 *
 * @property string $id
 * @property string $service
 * @property string[] $attributes
 * @property string[] $tags
 * @property string[] $options
 */
class Image implements JsonSerializable {

    protected $id;
    protected $service;
    protected $attributes = [];
    protected $tags = [];
    protected $options = [];

    const STATUS_CLEAN = "clean";       // image is in sync with the local database and the image service
    const STATUS_NEW = "new";           // image needs to be created in local database and image service (The id can be left empty and will be set by the image service!)
    const STATUS_DIRTY = "dirty";       // image needs to be updated in local database and image service
    const STATUS_DELETED = "deleted";   // image needs to be deleted (Will be removed from local database but may not be deleted from image service at discretion of the service)


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
            case "attributes":
            case "tags":
            case "options":
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
            case "id":
            case "service":
            $this->{$name} = $value;
                break;
            case "options":
            case "attributes":
                $this->{$name} = is_array($value) ? $value : array();
                break;
            case "tags":
                $this->tags = $value ? $value : array();
                asort($this->tags);
                $this->tags = array_unique($this->tags);
                $this->tags = array_values($this->tags);
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
     * @return string
     */
    public function jsonSerialize() {
        $output = [
            "id"         => $this->id,
            "service"    => $this->service,
            "attributes" => $this->attributes,
            "tags"       => $this->tags,
            "options"    => $this->options
        ];

        return $output;
    }

    public static function create($input){
        $image = new self($input["id"], $input["service"]);

        $image->__set("attributes", $input["attributes"]);
        $image->__set("tags",       $input["tags"]);
        $image->__set("options",    $input["options"]);

        return $image;
    }
}