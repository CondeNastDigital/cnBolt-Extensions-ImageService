<?php

namespace Bolt\Extension\CND\ImageService\Traits;

trait ContentValuesTrait
{
    /**
     * Get the first image in the content.
     *
     * @return string
     */
    public function getImage() {

        $result = parent::getImage();
        if($result)
            return $result;

        // Grab the first field of type 'imageservicelist', and return that.
        foreach ($this->contenttype['fields'] as $key => $field) {
            if ($field['type'] === 'imageservicelist' && isset($this->values[$key])) {
                $value = $this->values[$key];
                return isset($value["items"][0]) ? $value["items"][0] : '';
            }
        }

        // otherwise, no image.
        return '';
    }
}