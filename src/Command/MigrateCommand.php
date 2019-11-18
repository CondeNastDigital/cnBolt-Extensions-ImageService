<?php


namespace Bolt\Extension\CND\ImageService\Command;

use Bolt\Extension\CND\ImageService\Extension;
use Bolt\Extension\CND\ImageService\Image;
use Doctrine\DBAL\Query\QueryBuilder;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

class MigrateCommand extends Command
{

    private $app;

    public function setApp($app) {
        $this->app = $app;
    }

    protected function configure() {
        $this->setName('imageservice:migrate:oldteaser')
              ->addArgument('contenttype', InputArgument::OPTIONAL, 'bolt_articles')
              ->addArgument('field', InputArgument::OPTIONAL, 'teaserimage')
              ->addArgument('limit', InputArgument::OPTIONAL, 'limit');
    }

    protected function execute(InputInterface $input, OutputInterface $output) {

        $contenttype = $input->getArgument('contenttype') ?? 'bolt_articles';
        $field       = $input->getArgument('field') ?? 'teaserimage';
        $limit       = $input->getArgument('limit') ?? 100;

        $contenttype = preg_replace("/[^a-z0-9\_\-]+/i",'', $contenttype);
        $field = preg_replace("/[^a-z0-9\_\-]+/i",'', $field);

        $repo = $this->app['storage']->getRepository($contenttype);
        /** @var QueryBuilder $qb */
        $qb = $repo->createQueryBuilder();

        $qb->where('`'.$field.'` NOT LIKE \'%"items":[]%\' AND `'.$field.'` != \'\' AND ((`'.$field.'` LIKE \'%"width":0%\' ) OR  NOT (`teaserimage` LIKE \'%"width"%\' ))')
            ->setMaxResults((int)$limit);

        $result = $qb->execute();
        $items  = $result->fetchAll() ;

        foreach ($items as $key => $item) {

            $images = json_decode($item[$field], true);
            $image  = isset($images['items'][0]) ? $images['items'][0] : null;

            if(!isset($image['id']))
                continue;

            $result = $this->app[Extension::APP_EXTENSION_KEY.".image"]->imageSearch($image['id']);

            $images['items'][0] = reset($result);

            $item[$field] = json_encode($images);
            $items[$key] = $item;

            /** @var QueryBuilder $update */
            $update = $repo->createQueryBuilder();
            $update->update($contenttype)
                ->set($field, json_encode($item[$field]))
                ->where('id = '.$update->createPositionalParameter($item['id']));

            dump($update->getSQL());
            $result = $update->execute();
            dump($result);

        }

        dump($qb->getSQL());

    }

}